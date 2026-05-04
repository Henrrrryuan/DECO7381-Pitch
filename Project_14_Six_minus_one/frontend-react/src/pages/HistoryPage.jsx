import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE, fetchJson, formatDate } from "../lib/common.js";
import { AccessibilityWidgetMount } from "../components/AccessibilityWidgetMount.jsx";
import { eyeTrackingHref, spaGuideAnalysisHref, spaHistoryHref } from "../lib/siteUrls.js";

const DESKTOP_MIN_PAGE_SIZE = 8;
const DESKTOP_MAX_PAGE_SIZE = 12;
const MOBILE_MIN_PAGE_SIZE = 6;
const MOBILE_MAX_PAGE_SIZE = 9;
const DASHBOARD_HISTORY_CONTEXT_KEY = "cognilens.dashboard.history-context";
const DASHBOARD_HISTORY_ONCE_KEY = "cognilens.dashboard.history-once";
const ANALYSIS_RETURN_URL_STORAGE_KEY = "cognilens.return.analysis-url";

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
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
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function HeatmapGrid({ gridCols, gridRows, cellCounts }) {
  const cols = Math.max(1, Number(gridCols) || 1);
  const expected = cols * Math.max(1, Number(gridRows) || 1);
  const list = Array.isArray(cellCounts) ? cellCounts.map((c) => Math.max(0, Number(c) || 0)) : [];
  while (list.length < expected) {
    list.push(0);
  }
  const trimmed = list.slice(0, expected);
  const max = Math.max(1, ...trimmed);

  return (
    <div
      className="history-heatmap-grid"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
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
              Relative attention by region (descriptive). Not a usability or accessibility score.
            </p>
          </div>
          <button className="history-modal-close-btn" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="history-behavioral-modal-body">
          {loading ? <p className="history-empty">Loading…</p> : null}
          {!loading && error ? <p className="history-empty">{error}</p> : null}
          {!loading && !error && session ? (
            <>
              <p className="history-behavioral-modal-meta">
                Attention coverage: {Number(session.coverage_percent ?? 0).toFixed(1)}% · Gaze samples:{" "}
                {session.sample_count} · Duration: {formatDuration(session.duration_ms)}
              </p>
              <HeatmapGrid
                gridCols={detail.grid_cols}
                gridRows={detail.grid_rows}
                cellCounts={detail.cell_counts}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SupportingEvidenceCell({ summary, onViewHeatmap, heatmapBusy }) {
  if (!summary?.available) {
    return <div className="history-supporting-none">No behavioral evidence</div>;
  }

  const coverage = Number(summary.coverage_percent ?? 0).toFixed(1);
  const samples = Number(summary.sample_count ?? 0);
  const duration = formatDuration(summary.duration_ms ?? 0);

  return (
    <div className="history-supporting-cell">
      <p className="history-supporting-available">Behavioral evidence available</p>
      <ul className="history-supporting-metrics">
        <li>
          Attention coverage: {coverage}%
        </li>
        <li>Gaze samples: {samples}</li>
        <li>Duration: {duration}</li>
      </ul>
      <button
        className="history-heatmap-btn"
        type="button"
        onClick={onViewHeatmap}
        disabled={heatmapBusy}
      >
        View Heatmap
      </button>
    </div>
  );
}

function ReportRows({ items, status, emptyMessage, onOpenReport, onOpenHeatmap, heatmapLoading }) {
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
        {item.source_name}
      </span>
      <span className="history-cell">{formatDate(item.created_at)}</span>
      <span className="history-cell score">{item.overall_score}</span>
      <span className="history-cell history-supporting-wrap">
        <SupportingEvidenceCell
          summary={item.eye_tracking_summary}
          onViewHeatmap={() => onOpenHeatmap(item.run_id)}
          heatmapBusy={heatmapLoading}
        />
      </span>
      <span className="history-cell action">
        <div className="history-actions">
          <button
            className="history-open-btn"
            type="button"
            data-run-id={item.run_id}
            onClick={() => onOpenReport(item.run_id)}
          >
            View
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
  heatmapLoading,
}) {
  const emptyMessage = query
    ? "No reports match the current file name or ID search."
    : "No analysis history has been saved yet.";

  return (
    <section className="history-list-shell">
      <div className="history-table-head">
        <span>Analysis</span>
        <span>Date</span>
        <span>Overall</span>
        <span>Supporting Evidence</span>
        <span>Actions</span>
      </div>
      <div id="historyList" className="history-table-body">
        <ReportRows
          items={items}
          status={status}
          emptyMessage={emptyMessage}
          onOpenReport={onOpenReport}
          onOpenHeatmap={onOpenHeatmap}
          heatmapLoading={heatmapLoading}
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
  }, [query, reportPage, reportPageSize]);

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

  useEffect(() => {
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
  }, []);

  return (
    <>
      <AccessibilityWidgetMount />
      <header className="app-nav">
        <div className="app-nav-inner">
          <Link className="app-brand" to="/">
            <span className="app-brand-mark">C</span>
            <span className="app-brand-name">CogniLens</span>
          </Link>

          <nav className="app-nav-links" aria-label="Primary">
            <Link to={spaGuideAnalysisHref}>Guide</Link>
            <a className="nav-eye-tracking" href={eyeTrackingHref}>
              Eye Tracking
            </a>
            <Link className="active-link" to={spaHistoryHref}>
              History
            </Link>
            <button id="backToAnalysisButtonHistory" className="nav-cta" type="button" hidden>
              Back to analysis
            </button>
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
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
            />
            <button id="historySearchButton" className="history-search-button" type="submit" aria-label="Search reports">
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
            heatmapLoading={heatmapLoading}
          />
        </div>
      </main>

      <BehavioralHeatmapModal
        open={heatmapOpen}
        onClose={closeHeatmap}
        detail={heatmapDetail}
        loading={heatmapLoading}
        error={heatmapError}
      />
    </>
  );
}
