import { useEffect, useMemo } from "react";

import {
  formatDate,
  formatShortId,
} from "../../utils/historyUtils.js";
import { EyeRows } from "./EyeRows.jsx";
import { Pagination } from "./Pagination.jsx";

export function EyeHistoryPanel({
  eyeSessionItems,
  totalEyeSessions,
  currentPage,
  pageSize,
  status,
  onPageChange,
  isModalOpen,
  onOpenModal,
  onCloseModal,
}) {
  // Summary container for optional Eye-Tracking Evidence. The old progressive
  // History page now shows a compact evidence overview beside reports and moves
  // the full evidence table into a modal. This Vite component mirrors that flow.
  const latestSession = eyeSessionItems[0] || null;
  const averageCoverage = useMemo(() => {
    if (!eyeSessionItems.length) {
      return "0.0";
    }
    const coverageSum = eyeSessionItems.reduce(
      (sum, eyeSession) => sum + Number(eyeSession.coverage_percent ?? 0),
      0,
    );
    return (coverageSum / eyeSessionItems.length).toFixed(1);
  }, [eyeSessionItems]);

  useEffect(() => {
    if (!isModalOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onCloseModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, onCloseModal]);

  return (
    <>
      <section className="history-list-shell eye-history-summary-shell">
        <div className="history-section-header history-section-header-compact">
          <div>
            <p className="upload-kicker">Supporting Evidence</p>
            <h2>Eye-Tracking Evidence</h2>
          </div>
        </div>

        <div className="history-evidence-summary-grid">
          <article className="history-evidence-summary-card">
            <span className="history-evidence-summary-label">Total sessions</span>
            <strong>{String(totalEyeSessions || 0)}</strong>
          </article>
          <article className="history-evidence-summary-card">
            <span className="history-evidence-summary-label">Avg coverage (this page)</span>
            <strong>{`${averageCoverage}%`}</strong>
          </article>
        </div>

        <div className="history-evidence-latest">
          <h3>Latest evidence session</h3>
          {status.loading ? (
            <p className="history-empty">Loading eye-tracking evidence...</p>
          ) : status.error ? (
            <p className="history-empty">{status.error}</p>
          ) : latestSession ? (
            <div className="history-evidence-latest-meta">
              <strong title={latestSession.source_name}>{latestSession.source_name}</strong>
              <span>{`Evidence ${formatShortId(latestSession.session_id, "E-")}`}</span>
              <span>{`Coverage ${Number(latestSession.coverage_percent ?? 0).toFixed(1)}%`}</span>
              <span>{formatDate(latestSession.created_at)}</span>
            </div>
          ) : (
            <p className="history-empty">No eye-tracking evidence sessions have been saved yet.</p>
          )}
        </div>

        <div className="history-evidence-actions">
          <button
            type="button"
            className="history-open-btn"
            onClick={onOpenModal}
          >
            View all evidence
          </button>
        </div>
      </section>

      {isModalOpen ? (
        <div className="history-evidence-modal-backdrop" role="presentation" onClick={onCloseModal}>
          <section
            className="history-list-shell eye-history-shell history-evidence-modal"
            role="dialog"
            aria-modal="true"
            aria-label="All eye-tracking evidence sessions"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="history-section-header">
              <div className="history-modal-title-wrap">
                <p className="upload-kicker">Supporting Evidence</p>
                <h2>All Eye-Tracking Evidence Sessions</h2>
              </div>
              <button
                type="button"
                className="history-modal-close-btn"
                aria-label="Close evidence drawer"
                onClick={onCloseModal}
              >
                Close
              </button>
            </div>

            <div className="history-eye-table-head">
              <span>Evidence ID</span>
              <span>Page</span>
              <span>Coverage</span>
            </div>

            <div id="eyeHistoryList" className="history-table-body">
              <EyeRows
                eyeSessionItems={eyeSessionItems}
                status={status}
                emptyMessage="No eye-tracking evidence sessions have been saved yet."
              />
            </div>

            <Pagination
              containerId="eyeHistoryPagination"
              ariaLabel="Eye-tracking evidence pagination"
              currentPage={currentPage}
              totalItems={totalEyeSessions}
              pageSize={pageSize}
              itemLabelText="sessions"
              onPageChange={onPageChange}
            />
          </section>
        </div>
      ) : null}
    </>
  );
}
