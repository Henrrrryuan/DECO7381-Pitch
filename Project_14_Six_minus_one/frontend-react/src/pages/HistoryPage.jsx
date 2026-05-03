import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  API_BASE,
  fetchJson,
  formatDate,
  formatReportTimestamp,
  formatShortId,
} from "../lib/common.js";
import { AccessibilityWidgetMount } from "../components/AccessibilityWidgetMount.jsx";
import { eyeTrackingHref, spaGuideAnalysisHref, spaHistoryHref } from "../lib/siteUrls.js";

const REPORT_PAGE_SIZE = 5;
const EYE_PAGE_SIZE = 25;
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

function ReportRows({ items, status, emptyMessage, onOpenReport }) {
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
        {formatReportTimestamp(item.created_at)}
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
            onClick={() => onOpenReport(item.run_id)}
          >
            View
          </button>
        </div>
      </span>
    </article>
  ));
}

function EyeRows({ items, status, emptyMessage }) {
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
      </article>
    );
  });
}

function EyeEvidencePanel({ items, total, page, status, onPageChange }) {
  const emptyMessage = "No eye-tracking evidence sessions have been saved yet.";
  return (
    <section className="eye-history-panel">
      <div className="history-evidence-inline-header">
        <p className="upload-kicker">Supporting Evidence</p>
        <h2>All Eye-Tracking Evidence Sessions</h2>
      </div>
      <div className="history-list-shell eye-history-shell">
        <div className="history-eye-table-head">
          <span>Evidence ID</span>
          <span>Page</span>
          <span>Coverage</span>
        </div>
        <div id="eyeHistoryList" className="history-table-body">
          <EyeRows items={items} status={status} emptyMessage={emptyMessage} />
        </div>
        <Pagination
          id="eyeHistoryPagination"
          ariaLabel="Eye-tracking evidence pagination"
          page={page}
          total={total}
          itemLabel="sessions"
          pageSize={EYE_PAGE_SIZE}
          onPageChange={onPageChange}
        />
      </div>
    </section>
  );
}

function ReportHistoryPanel({
  items,
  total,
  page,
  status,
  query,
  onPageChange,
  onOpenReport,
}) {
  const emptyMessage = query
    ? "No reports match the current file name or ID search."
    : "No analysis history has been saved yet.";

  return (
    <section className="history-list-shell">
      <div className="history-table-head">
        <span>Report ID</span>
        <span>File</span>
        <span>Date</span>
        <span>Overall</span>
        <span>Actions</span>
      </div>
      <div id="historyList" className="history-table-body">
        <ReportRows items={items} status={status} emptyMessage={emptyMessage} onOpenReport={onOpenReport} />
      </div>
      <Pagination
        id="historyPagination"
        ariaLabel="Report history pagination"
        page={page}
        total={total}
        itemLabel="reports"
        pageSize={REPORT_PAGE_SIZE}
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
  const [eyePage, setEyePage] = useState(1);
  const [reports, setReports] = useState({ items: [], total: 0 });
  const [eyeSessions, setEyeSessions] = useState({ items: [], total: 0 });
  const [reportStatus, setReportStatus] = useState({ loading: true, error: "" });
  const [eyeStatus, setEyeStatus] = useState({ loading: true, error: "" });

  useEffect(() => {
    const controller = new AbortController();
    setReportStatus({ loading: true, error: "" });

    fetchJson(buildPagedUrl("/history", reportPage, query, REPORT_PAGE_SIZE), { signal: controller.signal })
      .then((payload) => {
        const total = Number(payload.total ?? payload.items?.length ?? 0) || 0;
        const totalPages = getTotalPages(total, REPORT_PAGE_SIZE);
        if (reportPage > totalPages) {
          setReportPage(totalPages);
          return;
        }

        setReports({
          items: payload.items || [],
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
  }, [query, reportPage]);

  useEffect(() => {
    const controller = new AbortController();
    setEyeStatus({ loading: true, error: "" });

    fetchJson(buildPagedUrl("/eye/sessions", eyePage, "", EYE_PAGE_SIZE), { signal: controller.signal })
      .then((payload) => {
        const total = Number(payload.total ?? payload.items?.length ?? 0) || 0;
        const totalPages = getTotalPages(total, EYE_PAGE_SIZE);
        if (eyePage > totalPages) {
          setEyePage(totalPages);
          return;
        }

        setEyeSessions({
          items: payload.items || [],
          total,
        });
        setEyeStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        if (error.name === "AbortError") {
          return;
        }
        setEyeSessions({ items: [], total: 0 });
        setEyeStatus({ loading: false, error: error.message });
      });

    return () => controller.abort();
  }, [eyePage]);

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
            <a href={eyeTrackingHref}>Eye Tracking</a>
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
          <h1>Previous Analyses</h1>
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
            status={reportStatus}
            query={query}
            onPageChange={setReportPage}
            onOpenReport={openReport}
          />
        </div>
        <div className="history-evidence-inline">
          <EyeEvidencePanel
            items={eyeSessions.items}
            total={eyeSessions.total}
            page={eyePage}
            status={eyeStatus}
            onPageChange={setEyePage}
          />
        </div>
      </main>
    </>
  );
}
