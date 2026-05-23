import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE, fetchJson, formatDate, formatReportTimestamp } from "../lib/common.js";
import { clearPendingVicramResult } from "../lib/pendingVicramSession.js";
import {
  EYE_EVIDENCE_DETAIL_FALLBACK,
  formatAttentionRiskLabel,
  getHeatmapEvidenceSummary,
  getOverallEvidenceRisk,
  getRiskDrivers,
} from "../lib/eyeEvidenceSummary.js";
import { AccessibilityWidgetMount } from "../components/AccessibilityWidgetMount.jsx";
import { eyeTrackingHref, spaHistoryHref } from "../lib/siteUrls.js";
import {
  formatHeatmapPageSizeLabel,
  getEyeHeatmapPageMetrics,
  getHeatmapGridPixelLayout,
} from "../lib/heatmapDisplay.js";

const DESKTOP_MIN_PAGE_SIZE = 8;
const DESKTOP_MAX_PAGE_SIZE = 12;
const MOBILE_MIN_PAGE_SIZE = 6;
const MOBILE_MAX_PAGE_SIZE = 9;
const DASHBOARD_HISTORY_CONTEXT_KEY = "cognilens.dashboard.history-context";
const DASHBOARD_HISTORY_ONCE_KEY = "cognilens.dashboard.history-once";
const ANALYSIS_RETURN_URL_STORAGE_KEY = "cognilens.return.analysis-url";
const AUTO_PRINT_STORAGE_KEY = "cognilens.dashboard.autoPrint";
const DASHBOARD_PRINT_IFRAME_ID = "historyPrintProxyFrame";

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function formatEvidenceConfidence(value) {
  const confidence = String(value || "").trim().toLowerCase();
  if (!confidence) {
    return "";
  }
  return `${confidence.charAt(0).toUpperCase()}${confidence.slice(1)}`;
}

function formatWeightedShare(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "";
  }
  return `${(numeric * 100).toFixed(1)}%`;
}

function getRiskDriverMeta(item) {
  const rows = [];
  const exactHits = Number(item.exactHitCount || 0);
  const nearHits = Number(item.nearHitCount || 0);
  const weightedShare = formatWeightedShare(item.weightedShare);
  if (exactHits > 0 || nearHits > 0) {
    rows.push(`Exact hits ${exactHits}, near hits ${nearHits}`);
  }
  if (weightedShare) {
    rows.push(`Weighted share ${weightedShare}`);
  }
  if (item.firstFixationMs != null) {
    rows.push(`First fixation ${formatDuration(item.firstFixationMs)}`);
  }
  return rows;
}

function getTotalPages(total, pageSize) {
  return Math.max(1, Math.ceil((Number(total) || 0) / pageSize));
}

function getPageOffset(page, pageSize) {
  return (Math.max(1, Number(page) || 1) - 1) * pageSize;
}

function buildPagedUrl(path, page, query, pageSize) {
  const params = new URLSearchParams({
    limit: String(pageSize),
    offset: String(getPageOffset(page, pageSize)),
  });
  if (query) {
    params.set("query", query);
  }
  return `${API_BASE}${path}?${params.toString()}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function computeReportPageSize(viewportHeight, viewportWidth) {
  const desktop = viewportWidth >= 1024;
  const minRows = desktop ? DESKTOP_MIN_PAGE_SIZE : MOBILE_MIN_PAGE_SIZE;
  const maxRows = desktop ? DESKTOP_MAX_PAGE_SIZE : MOBILE_MAX_PAGE_SIZE;
  const reservedHeight = desktop ? 360 : 330;
  const rowHeight = desktop ? 74 : 84;
  const usableHeight = Math.max(0, viewportHeight - reservedHeight);
  const estimatedRows = Math.floor(usableHeight / rowHeight);
  return clamp(estimatedRows, minRows, maxRows);
}

function Pagination({
  id,
  ariaLabel,
  page,
  total,
  itemLabel,
  pageSize,
  onPageChange,
}) {
  const totalPages = getTotalPages(total, pageSize);
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const startItem = total ? getPageOffset(safePage, pageSize) + 1 : 0;
  const endItem = Math.min(getPageOffset(safePage, pageSize) + pageSize, total);

  return (
    <div id={id} className="history-pagination" aria-label={ariaLabel}>
      <div className="history-pagination-summary">
        <strong>
          Page {safePage} / {totalPages}
        </strong>
        <span>
          {startItem}-{endItem} of {total} {itemLabel}
        </span>
      </div>
      <div className="history-pagination-controls">
        <button
          className="history-page-btn"
          type="button"
          disabled={safePage <= 1}
          data-accessibility-tooltip={`Go to the previous page of ${itemLabel}.`}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
        >
          Previous
        </button>
        <span className="history-pagination-page-indicator" aria-live="polite">
          {safePage} / {totalPages}
        </span>
        <button
          className="history-page-btn"
          type="button"
          disabled={safePage >= totalPages}
          data-accessibility-tooltip={`Go to the next page of ${itemLabel}.`}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function HeatmapGrid({ gridCols, gridRows, cellCounts, pageMetrics }) {
  const cols = Math.max(1, Number(gridCols) || 1);
  const rows = Math.max(1, Number(gridRows) || 1);
  const expected = cols * rows;
  const list = Array.isArray(cellCounts) ? cellCounts.map((c) => Math.max(0, Number(c) || 0)) : [];
  while (list.length < expected) {
    list.push(0);
  }
  const trimmed = list.slice(0, expected);
  const max = Math.max(1, ...trimmed);
  const shellRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(320);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      return undefined;
    }
    const updateWidth = () => {
      setContainerWidth(Math.max(220, shell.clientWidth || 320));
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  const layout = getHeatmapGridPixelLayout(pageMetrics, cols, rows, containerWidth);

  return (
    <div ref={shellRef} className="history-heatmap-grid-scroll">
      <div
        className="history-heatmap-grid"
        style={{
          width: layout.width,
          height: layout.height,
          minWidth: layout.width,
          minHeight: layout.height,
          gridTemplateColumns: layout.gridTemplateColumns,
          gridTemplateRows: layout.gridTemplateRows,
        }}
      >
        {trimmed.map((count, index) => {
          const t = count / max;
          const alpha = 0.07 + t * 0.38;
          return (
            <div
              key={`cell-${index}`}
              className="history-heatmap-cell"
              style={{ background: `rgba(51, 65, 85, ${alpha})` }}
            />
          );
        })}
      </div>
    </div>
  );
}

function EyeEvidenceDetailPanel({ summary, eyeEvidence }) {
  const riskDrivers = getRiskDrivers(summary);
  const overallRisk = getOverallEvidenceRisk(riskDrivers, eyeEvidence);
  const balancedSummary = getHeatmapEvidenceSummary(riskDrivers, eyeEvidence);
  const evidenceConfidence = formatEvidenceConfidence(
    eyeEvidence?.evidence_confidence || eyeEvidence?.confidence,
  );

  return (
    <aside className="history-eye-detail-panel" aria-label="Eye evidence detail">
      <div className="history-eye-detail-header">
        <h3>Eye Evidence Detail</h3>
        {overallRisk ? (
          <p className="history-eye-overall-risk">
            <span>Overall risk:</span>
            <span className={`history-risk-pill is-${overallRisk}`}>
              {formatAttentionRiskLabel(overallRisk)}
            </span>
          </p>
        ) : null}
        {evidenceConfidence ? (
          <p className="history-eye-confidence">
            <span>Evidence confidence:</span>
            <strong>{evidenceConfidence}</strong>
          </p>
        ) : null}
      </div>

      <div className="history-eye-detail-section">
        <p className="history-eye-detail-label">Interpretation:</p>
        <div className="history-eye-feedback-lines">
          <p>Overall: {balancedSummary.overall}</p>
          <p>Positive: {balancedSummary.positive}</p>
          <p>Risk: {balancedSummary.risk}</p>
          <p>Priority: {balancedSummary.priority}</p>
        </div>
      </div>

      {riskDrivers.length ? (
        <div className="history-eye-detail-section">
          <p className="history-eye-detail-label">Risk drivers:</p>
          <ul className="history-eye-risk-list">
            {riskDrivers.map((item) => {
              const meta = getRiskDriverMeta(item);
              return (
                <li key={`${item.elementType}-${item.label}`} className="history-eye-risk-item">
                  <div className="history-eye-risk-title">
                    <span>{item.label}</span>
                    <span className={`history-risk-pill is-${item.riskLevel}`}>{item.riskLabel}</span>
                  </div>
                  <p>{item.interpretation}</p>
                  {meta.length ? <p className="history-eye-risk-meta">{meta.join(" | ")}</p> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="history-eye-detail-empty">{EYE_EVIDENCE_DETAIL_FALLBACK}</p>
      )}
    </aside>
  );
}

function BehavioralHeatmapModal({ open, onClose, detail, loading, error }) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKey = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const session = detail?.session;
  const eyeEvidence = detail?.eye_evidence || {};
  const pageMetrics = getEyeHeatmapPageMetrics(detail);
  const pageSizeLabel = formatHeatmapPageSizeLabel(pageMetrics);
  const evidenceSummary = {
    ...(detail?.summary || {}),
    eye_evidence: eyeEvidence,
  };

  return (
    <div
      className="history-behavioral-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="history-behavioral-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-behavioral-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="history-behavioral-modal-header">
          <div className="history-modal-title-wrap">
            <h2 id="history-behavioral-modal-title">Heatmap</h2>
            <p className="history-behavioral-modal-note">
              Full-page attention grid ({detail?.grid_cols || 24}×{detail?.grid_rows || 14} regions).
              Scroll the map to see below-the-fold areas on long pages. Descriptive evidence only.
            </p>
          </div>
          <button
            className="history-modal-close-btn"
            type="button"
            data-accessibility-tooltip="Close the heatmap dialog and return to history."
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="history-behavioral-modal-body">
          {loading ? <p className="history-empty">Loading…</p> : null}
          {!loading && error ? <p className="history-empty">{error}</p> : null}
          {!loading && !error && session ? (
            <div className="history-heatmap-detail-layout">
              <div className="history-heatmap-panel">
              <p className="history-behavioral-modal-meta">
                Attention coverage: {Number(session.coverage_percent ?? 0).toFixed(1)}% · Gaze samples:{" "}
                {session.sample_count} · Duration: {formatDuration(session.duration_ms)}
                {pageSizeLabel ? ` · ${pageSizeLabel}` : ""}
                {!pageMetrics.hasDocumentSize
                  ? " · Page size estimated — re-save Eye session for exact proportions"
                  : ""}
                {" · Scroll or drag inside the map"}
              </p>
                <div className="history-heatmap-grid-shell">
                  <HeatmapGrid
                    gridCols={detail.grid_cols}
                    gridRows={detail.grid_rows}
                    cellCounts={detail.cell_counts}
                    pageMetrics={pageMetrics}
                  />
                </div>
              </div>
              <EyeEvidenceDetailPanel summary={evidenceSummary} eyeEvidence={eyeEvidence} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function getVicramBadgeTone(riskLevel) {
  const level = String(riskLevel || "").trim().toLowerCase();
  if (level === "high") {
    return "high";
  }
  if (level === "medium") {
    return "moderate";
  }
  return "low";
}

function getEyeEvidenceBadgeTone(riskLevel) {
  return getVicramBadgeTone(riskLevel);
}

function formatVicramScoreMeta(vcs) {
  const numericVcs = Number(vcs);
  if (!Number.isFinite(numericVcs)) {
    return "";
  }
  return `Score: ${numericVcs.toFixed(2)}`;
}

function HistoryEvidenceEmpty() {
  return <span className="history-evidence-empty">Not available</span>;
}

function VisualComplexityColumn({ summary, onViewComplexityMap, complexityBusy }) {
  if (!summary?.available) {
    return <HistoryEvidenceEmpty />;
  }
  const riskLevel = String(summary.risk_level || "").toLowerCase();
  const complexityLevel = String(summary.risk_label || "").trim() || "Visual complexity";
  const tone = getVicramBadgeTone(riskLevel);
  const ariaLabel =
    summary.vcs != null && Number.isFinite(Number(summary.vcs))
      ? `Visual complexity score ${Number(summary.vcs).toFixed(2)}, ${complexityLevel}`
      : complexityLevel;

  return (
    <div className="history-supporting-cell">
      <p
        className={`vicram-dashboard-level vicram-dashboard-level-${tone}`}
        aria-label={ariaLabel}
      >
        {complexityLevel}
      </p>
      <button
        className="history-heatmap-btn"
        type="button"
        data-accessibility-tooltip="Open the ViCRAM complexity map saved for this analysis report."
        onClick={onViewComplexityMap}
        disabled={complexityBusy}
      >
        View Complexity Map
      </button>
    </div>
  );
}

function EyeEvidenceColumn({ summary, onViewHeatmap, heatmapBusy }) {
  if (!summary?.available) {
    return <HistoryEvidenceEmpty />;
  }
  const riskDrivers = getRiskDrivers(summary);
  const eyeEvidence = summary.eye_evidence || {};
  const overallRisk = getOverallEvidenceRisk(riskDrivers, eyeEvidence);
  const riskLabel = overallRisk ? formatAttentionRiskLabel(overallRisk) : "";
  const tone = getEyeEvidenceBadgeTone(overallRisk);

  return (
    <div className="history-supporting-cell">
      {riskLabel ? (
        <p
          className={`vicram-dashboard-level vicram-dashboard-level-${tone}`}
          aria-label={riskLabel}
        >
          {riskLabel}
        </p>
      ) : null}
      <button
        className="history-heatmap-btn"
        type="button"
        data-accessibility-tooltip="Open the gaze heatmap linked to this analysis report."
        onClick={onViewHeatmap}
        disabled={heatmapBusy}
      >
        View Heatmap
      </button>
    </div>
  );
}

function HistoryDeleteConfirmModal({ open, target, deleting, error, onCancel, onConfirm }) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKey = (event) => {
      if (event.key === "Escape" && !deleting) {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, deleting, onCancel]);

  if (!open || !target) {
    return null;
  }

  const sourceLabel = String(target.source_name || "this analysis").trim() || "this analysis";

  return (
    <div
      className="history-behavioral-modal-backdrop"
      role="presentation"
      onClick={deleting ? undefined : onCancel}
    >
      <div
        className="history-behavioral-modal history-confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="history-delete-modal-title"
        aria-describedby="history-delete-modal-description"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="history-behavioral-modal-header">
          <div className="history-modal-title-wrap">
            <h2 id="history-delete-modal-title">Delete analysis record?</h2>
            <p id="history-delete-modal-description" className="history-behavioral-modal-note">
              Delete this analysis record? This will also remove linked eye evidence and visual complexity
              data.
            </p>
            <p className="history-delete-target-label">
              <strong>{sourceLabel}</strong>
            </p>
          </div>
        </div>
        <div className="history-behavioral-modal-body history-confirm-modal-body">
          {error ? <p className="history-delete-error">{error}</p> : null}
          <div className="history-confirm-actions">
            <button
              className="history-confirm-btn history-confirm-btn--secondary"
              type="button"
              disabled={deleting}
              data-accessibility-tooltip="Cancel deletion and keep this history record."
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="history-confirm-btn history-confirm-btn--danger"
              type="button"
              disabled={deleting}
              data-accessibility-tooltip="Permanently delete this saved analysis and linked evidence."
              onClick={onConfirm}
            >
              {deleting ? "Deleting…" : "Delete record"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VisualComplexityMapModal({ open, onClose, detail, loading, error }) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKey = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const overlay = detail?.artifacts?.overlay_svg_base64 || "";
  const overlaySrc = overlay ? `data:image/svg+xml;base64,${overlay}` : "";

  return (
    <div
      className="history-behavioral-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="history-behavioral-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-visual-complexity-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="history-behavioral-modal-header">
          <div className="history-modal-title-wrap">
            <h2 id="history-visual-complexity-modal-title">Visual Complexity Map</h2>
            <p className="history-behavioral-modal-note">
              ViCRAM grid overlay for this saved analysis. Descriptive complexity evidence only.
            </p>
          </div>
          <button
            className="history-modal-close-btn"
            type="button"
            data-accessibility-tooltip="Close the complexity map dialog and return to history."
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="history-behavioral-modal-body">
          {loading ? <p className="history-empty">Loading…</p> : null}
          {!loading && error ? <p className="history-empty">{error}</p> : null}
          {!loading && !error && detail?.available ? (
            <>
              {formatVicramScoreMeta(detail.vcs) ? (
                <p className="history-behavioral-modal-meta">{formatVicramScoreMeta(detail.vcs)}</p>
              ) : null}
              {overlaySrc ? (
                <div className="history-vicram-map-shell">
                  <img
                    className="history-vicram-map-image"
                    src={overlaySrc}
                    alt="ViCRAM visual complexity map overlay"
                  />
                </div>
              ) : (
                <p className="history-empty">No complexity map overlay was stored for this report.</p>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReportRows({
  items,
  status,
  emptyMessage,
  onOpenReport,
  onOpenHeatmap,
  onOpenComplexityMap,
  onPrintReport,
  onRequestDelete,
  deleteBusyRunId,
  heatmapLoading,
  complexityLoading,
}) {
  if (status.loading) {
    return <p className="history-empty">Loading analysis history…</p>;
  }
  if (status.error) {
    return <p className="history-empty">{status.error}</p>;
  }
  if (!items.length) {
    return <p className="history-empty">{emptyMessage}</p>;
  }

  return items.map((item) => (
    <article className="history-row" key={item.run_id}>
      <span className="history-cell history-analysis" title={item.source_name}>
        <strong className="history-analysis-name">{item.source_name}</strong>
        <small className="history-analysis-trace-id">ID: {formatReportTimestamp(item.created_at)}</small>
      </span>
      <span className="history-cell">{formatDate(item.created_at)}</span>
      <span className="history-cell history-evidence-cell">
        <VisualComplexityColumn
          summary={item.visual_complexity_summary}
          onViewComplexityMap={() => onOpenComplexityMap(item.run_id)}
          complexityBusy={complexityLoading}
        />
      </span>
      <span className="history-cell history-evidence-cell">
        <EyeEvidenceColumn
          summary={item.eye_tracking_summary}
          onViewHeatmap={() => onOpenHeatmap(item.run_id)}
          heatmapBusy={heatmapLoading}
        />
      </span>
      <span className="history-cell action">
        <div className="history-actions">
          <button
            className="history-action-btn history-action-btn--primary"
            type="button"
            data-run-id={item.run_id}
            data-accessibility-tooltip="Open this saved analysis report in the dashboard."
            onClick={() => onOpenReport(item.run_id)}
          >
            View
          </button>
          <button
            className="history-action-btn history-action-btn--icon"
            type="button"
            title="Open printable report view"
            aria-label="Open printable report view"
            data-accessibility-tooltip="Open this report in a printable dashboard view."
            onClick={() => onPrintReport(item.run_id)}
          >
            <span className="history-action-icon" aria-hidden="true">
              ⬇
            </span>
          </button>
          <button
            className="history-action-btn history-action-btn--danger"
            type="button"
            disabled={deleteBusyRunId === item.run_id}
            data-accessibility-tooltip="Delete this saved analysis and its linked evidence."
            onClick={() => onRequestDelete(item)}
          >
            Delete
          </button>
        </div>
      </span>
    </article>
  ));
}

function ReportHistoryPanel({
  items,
  total,
  page,
  pageSize,
  status,
  query,
  onPageChange,
  onOpenReport,
  onOpenHeatmap,
  onOpenComplexityMap,
  onPrintReport,
  onRequestDelete,
  deleteBusyRunId,
  heatmapLoading,
  complexityLoading,
}) {
  const emptyMessage = query
    ? "No reports match the current file name or ID search."
    : "No analysis history has been saved yet.";

  return (
    <section className="history-list-shell">
      <div className="history-table-head">
        <span>Analysis</span>
        <span>Date</span>
        <span>Visual Complexity</span>
        <span>Eye Evidence</span>
        <span>Actions</span>
      </div>
      <div id="historyList" className="history-table-body">
        <ReportRows
          items={items}
          status={status}
          emptyMessage={emptyMessage}
          onOpenReport={onOpenReport}
          onOpenHeatmap={onOpenHeatmap}
          onOpenComplexityMap={onOpenComplexityMap}
          onPrintReport={onPrintReport}
          onRequestDelete={onRequestDelete}
          deleteBusyRunId={deleteBusyRunId}
          heatmapLoading={heatmapLoading}
          complexityLoading={complexityLoading}
        />
      </div>
      <Pagination
        id="historyPagination"
        ariaLabel="Report history pagination"
        page={page}
        total={total}
        itemLabel="reports"
        pageSize={pageSize}
        onPageChange={onPageChange}
      />
    </section>
  );
}

export function HistoryPage() {
  useEffect(() => {
    document.body.classList.add("history-body");
    return () => document.body.classList.remove("history-body");
  }, []);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Landing/start history is pre-analysis, so it must not expose analysis-only navigation.
  const historySource = searchParams.get("source");
  const isLandingHistory = historySource === "landing" || historySource === "start";
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [reportPage, setReportPage] = useState(1);
  const [reportPageSize, setReportPageSize] = useState(() =>
    computeReportPageSize(
      typeof window === "undefined" ? 900 : window.innerHeight,
      typeof window === "undefined" ? 1280 : window.innerWidth,
    ),
  );
  const [reports, setReports] = useState({ items: [], total: 0 });
  const [reportStatus, setReportStatus] = useState({ loading: true, error: "" });

  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const [heatmapDetail, setHeatmapDetail] = useState(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [heatmapError, setHeatmapError] = useState("");

  const [complexityOpen, setComplexityOpen] = useState(false);
  const [complexityDetail, setComplexityDetail] = useState(null);
  const [complexityLoading, setComplexityLoading] = useState(false);
  const [complexityError, setComplexityError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [historyRefreshNonce, setHistoryRefreshNonce] = useState(0);

  useEffect(() => {
    const updatePageSize = () => {
      const next = computeReportPageSize(window.innerHeight, window.innerWidth);
      setReportPageSize((previous) => {
        if (previous === next) {
          return previous;
        }
        setReportPage((currentPage) => {
          const firstItemIndex = getPageOffset(currentPage, previous);
          return Math.floor(firstItemIndex / next) + 1;
        });
        return next;
      });
    };

    updatePageSize();
    window.addEventListener("resize", updatePageSize);
    return () => window.removeEventListener("resize", updatePageSize);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setReportStatus({ loading: true, error: "" });

    fetchJson(buildPagedUrl("/history", reportPage, query, reportPageSize), {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((payload) => {
        const total = Number(payload.total ?? payload.items?.length ?? 0) || 0;
        const totalPages = getTotalPages(total, reportPageSize);
        if (reportPage > totalPages) {
          setReportPage(totalPages);
          return;
        }

        const rawItems = payload.items || [];
        const items = rawItems.map((row) => ({
          ...row,
          eye_tracking_summary: row.eye_tracking_summary || { available: false },
          visual_complexity_summary: row.visual_complexity_summary || { available: false },
        }));

        setReports({
          items,
          total,
        });
        setReportStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        if (error.name === "AbortError") {
          return;
        }
        setReports({ items: [], total: 0 });
        setReportStatus({ loading: false, error: error.message });
      });

    return () => controller.abort();
  }, [query, reportPage, reportPageSize, historyRefreshNonce]);

  const runSearch = useCallback(
    (event) => {
      event?.preventDefault();
      setQuery(queryInput.trim());
      setReportPage(1);
    },
    [queryInput],
  );

  const openReport = useCallback(
    (runId) => {
      clearPendingVicramResult();
      sessionStorage.setItem(DASHBOARD_HISTORY_CONTEXT_KEY, runId);
      sessionStorage.setItem(DASHBOARD_HISTORY_ONCE_KEY, "1");
      navigate(`/dashboard?from=history&run=${encodeURIComponent(runId)}`);
    },
    [navigate],
  );

  const closeHeatmap = useCallback(() => {
    setHeatmapOpen(false);
    setHeatmapDetail(null);
    setHeatmapError("");
    setHeatmapLoading(false);
  }, []);

  const openHeatmap = useCallback((runId) => {
    setHeatmapOpen(true);
    setHeatmapDetail(null);
    setHeatmapError("");
    setHeatmapLoading(true);

    const url = `${API_BASE}/eye/sessions/by-run/${encodeURIComponent(runId)}`;
    fetchJson(url)
      .then((data) => {
        setHeatmapDetail(data);
        setHeatmapLoading(false);
      })
      .catch((error) => {
        setHeatmapDetail(null);
        setHeatmapLoading(false);
        setHeatmapError(error.message || "Could not load heatmap.");
      });
  }, []);

  const closeComplexityMap = useCallback(() => {
    setComplexityOpen(false);
    setComplexityDetail(null);
    setComplexityError("");
    setComplexityLoading(false);
  }, []);

  const openComplexityMap = useCallback((runId) => {
    setComplexityOpen(true);
    setComplexityDetail(null);
    setComplexityError("");
    setComplexityLoading(true);

    fetchJson(`${API_BASE}/history/${encodeURIComponent(runId)}`, { cache: "no-store" })
      .then((data) => {
        const detail = data?.visual_complexity_detail || { available: false };
        if (!detail.available) {
          setComplexityDetail(null);
          setComplexityError("No visual complexity evidence was saved for this report.");
        } else {
          setComplexityDetail(detail);
        }
        setComplexityLoading(false);
      })
      .catch((error) => {
        setComplexityDetail(null);
        setComplexityLoading(false);
        setComplexityError(error.message || "Could not load visual complexity map.");
      });
  }, []);

  const closeDeleteModal = useCallback(() => {
    if (deleteBusy) {
      return;
    }
    setDeleteTarget(null);
    setDeleteError("");
  }, [deleteBusy]);

  const openDeleteModal = useCallback((item) => {
    setDeleteTarget({
      run_id: item.run_id,
      source_name: item.source_name,
    });
    setDeleteError("");
  }, []);

  const confirmDelete = useCallback(async () => {
    const runId = String(deleteTarget?.run_id || "").trim();
    if (!runId || deleteBusy) {
      return;
    }

    setDeleteBusy(true);
    setDeleteError("");
    try {
      await fetchJson(`${API_BASE}/history/${encodeURIComponent(runId)}`, {
        method: "DELETE",
        cache: "no-store",
      });
      setDeleteTarget(null);
      setDeleteError("");
      const remainingOnPage = reports.items.length - 1;
      if (remainingOnPage <= 0 && reportPage > 1) {
        setReportPage((current) => Math.max(1, current - 1));
      } else {
        setHistoryRefreshNonce((value) => value + 1);
      }
    } catch (error) {
      setDeleteError(error.message || "Could not delete this history record.");
    } finally {
      setDeleteBusy(false);
    }
  }, [deleteBusy, deleteTarget, reportPage, reports.items.length]);

  const printReport = useCallback((runId) => {
    if (!runId) {
      return;
    }
    try {
      sessionStorage.setItem(AUTO_PRINT_STORAGE_KEY, "true");
    } catch {
      // keep
    }
    const target = `/dashboard?from=history&run=${encodeURIComponent(runId)}&autoprint=1`;
    let frame = document.getElementById(DASHBOARD_PRINT_IFRAME_ID);
    if (!frame) {
      frame = document.createElement("iframe");
      frame.id = DASHBOARD_PRINT_IFRAME_ID;
      frame.title = "print-proxy";
      frame.setAttribute("aria-hidden", "true");
      frame.style.position = "fixed";
      frame.style.width = "1px";
      frame.style.height = "1px";
      frame.style.opacity = "0";
      frame.style.pointerEvents = "none";
      frame.style.border = "0";
      frame.style.bottom = "0";
      frame.style.right = "0";
      document.body.appendChild(frame);
    }
    frame.src = target;
  }, []);

  useEffect(() => {
    if (isLandingHistory) {
      return undefined;
    }
    const backButton = document.getElementById("backToAnalysisButtonHistory");
    if (!backButton) {
      return undefined;
    }
    let returnUrl = "";
    try {
      returnUrl = sessionStorage.getItem(ANALYSIS_RETURN_URL_STORAGE_KEY) || "";
    } catch {
      returnUrl = "";
    }
    if (returnUrl) {
      try {
        const parsedUrl = new URL(returnUrl, window.location.href);
        if (parsedUrl.searchParams.get("from") === "history") {
          returnUrl = "/dashboard";
          sessionStorage.setItem(ANALYSIS_RETURN_URL_STORAGE_KEY, returnUrl);
        }
      } catch {
        // keep
      }
    }
    if (!returnUrl) {
      return undefined;
    }
    backButton.hidden = false;
    const onClick = () => {
      window.location.href = returnUrl;
    };
    backButton.addEventListener("click", onClick);
    return () => backButton.removeEventListener("click", onClick);
  }, [isLandingHistory]);

  return (
    <>
      <AccessibilityWidgetMount />
      <header className="app-nav">
        <div className="app-nav-inner">
          <Link className="app-brand" to="/">
            <img className="app-brand-mark" src="/logo-mascot.png" alt="CogniLens mascot" />
            <span className="app-brand-name">CogniLens</span>
          </Link>

          <nav className="app-nav-links" aria-label="Primary">
            {isLandingHistory ? (
              <Link className="nav-cta" to="/">
                Back to start
              </Link>
            ) : (
              <>
                <a className="nav-eye-tracking" href={eyeTrackingHref}>
                  Eye Tracking
                </a>
                <Link className="active-link" to={spaHistoryHref}>
                  History
                </Link>
                <button
                  id="backToAnalysisButtonHistory"
                  className="nav-cta nav-cta-return"
                  type="button"
                  data-accessibility-tooltip="Return to the analysis dashboard you opened before history."
                  hidden
                >
                  <span className="nav-cta-icon" aria-hidden="true">
                    ←
                  </span>
                  Back to analysis
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="historyRoot" className="history-page">
        <section className="history-hero">
          <h1>Analysis history</h1>
          <p className="history-hero-sub">
            Cognitive accessibility analyses; behavioral gaze evidence may be linked when recorded.
          </p>
        </section>

        <section className="history-toolbar" aria-label="History search">
          <form
            className="history-search-row"
            onSubmit={(event) => {
              event.preventDefault();
              runSearch(event);
            }}
          >
            <input
              id="historySearchInput"
              className="history-search-input"
              type="search"
              placeholder="Enter a file name or report ID"
              autoComplete="off"
              data-accessibility-tooltip="Search saved reports by file name or report ID."
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
            />
            <button
              id="historySearchButton"
              className="history-search-button"
              type="submit"
              aria-label="Search reports"
              data-accessibility-tooltip="Run the history search using the text in the search field."
            >
              <span aria-hidden="true">🔍</span>
            </button>
          </form>
        </section>

        <div className="history-grid">
          <ReportHistoryPanel
            items={reports.items}
            total={reports.total}
            page={reportPage}
            pageSize={reportPageSize}
            status={reportStatus}
            query={query}
            onPageChange={setReportPage}
            onOpenReport={openReport}
            onOpenHeatmap={openHeatmap}
            onOpenComplexityMap={openComplexityMap}
            onPrintReport={printReport}
            onRequestDelete={openDeleteModal}
            deleteBusyRunId={deleteBusy ? deleteTarget?.run_id : ""}
            heatmapLoading={heatmapLoading}
            complexityLoading={complexityLoading}
          />
        </div>
      </main>

      <HistoryDeleteConfirmModal
        open={Boolean(deleteTarget)}
        target={deleteTarget}
        deleting={deleteBusy}
        error={deleteError}
        onCancel={closeDeleteModal}
        onConfirm={confirmDelete}
      />
      <BehavioralHeatmapModal
        open={heatmapOpen}
        onClose={closeHeatmap}
        detail={heatmapDetail}
        loading={heatmapLoading}
        error={heatmapError}
      />
      <VisualComplexityMapModal
        open={complexityOpen}
        onClose={closeComplexityMap}
        detail={complexityDetail}
        loading={complexityLoading}
        error={complexityError}
      />
    </>
  );
}
