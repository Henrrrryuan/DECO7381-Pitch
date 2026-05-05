import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE, fetchJson, formatDate, formatReportTimestamp } from "../lib/common.js";
import { AccessibilityWidgetMount } from "../components/AccessibilityWidgetMount.jsx";
import { eyeTrackingHref, spaGuideAnalysisHref, spaHistoryHref } from "../lib/siteUrls.js";

const DESKTOP_MIN_PAGE_SIZE = 8;
const DESKTOP_MAX_PAGE_SIZE = 12;
const MOBILE_MIN_PAGE_SIZE = 6;
const MOBILE_MAX_PAGE_SIZE = 9;
const DASHBOARD_HISTORY_CONTEXT_KEY = "cognilens.dashboard.history-context";
const DASHBOARD_HISTORY_ONCE_KEY = "cognilens.dashboard.history-once";
const ANALYSIS_RETURN_URL_STORAGE_KEY = "cognilens.return.analysis-url";
const ATTENTION_RISK_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
};
const EYE_EVIDENCE_DETAIL_FALLBACK =
  "Eye evidence is available, but detailed element risk data is not available for this run.";
const ELEMENT_TYPE_ALIASES = {
  heading: "headings",
  headings: "headings",
  interactive: "interactive",
  "interactive elements": "interactive",
  button: "interactive",
  link: "interactive",
  main: "main_text",
  "main text": "main_text",
  main_text: "main_text",
  text: "main_text",
  media: "media",
  image: "media",
  images: "media",
  "images/media": "media",
  navigation: "navigation",
  nav: "navigation",
};
const ELEMENT_EVIDENCE_COPY = {
  headings: {
    label: "Headings",
    historyIdea: "understand the structure",
    detailIdea: "understand the page structure",
    interpretations: {
      high: "Users may not notice the page structure clearly.",
      medium: "The page structure may not be immediately clear to users.",
      low: "Users appear to notice the page structure appropriately.",
    },
  },
  interactive: {
    label: "Interactive elements",
    historyIdea: "find the next action",
    detailIdea: "find the next action",
    interpretations: {
      high: "Users may struggle to find the next action.",
      medium: "Key actions may need stronger visual cues.",
      low: "Interactive elements appear to receive appropriate attention.",
    },
  },
  main_text: {
    label: "Main text",
    historyIdea: "process key content",
    detailIdea: "process key content without missing information or extra reading effort",
    interpretations: {
      high: "Users may not process the core content effectively.",
      medium: "Users may either miss key content or spend too much effort reading.",
      low: "Users appear to process the main content within a balanced attention range.",
    },
  },
  media: {
    label: "Images/media",
    historyIdea: "avoid media distraction",
    detailIdea: "keep media attention aligned with the main task",
    interpretations: {
      high: "Media may be drawing attention away from the main task.",
      medium: "Media may be attracting attention but not necessarily supporting the task.",
      low: "Media does not appear to create a major attention risk.",
    },
  },
  navigation: {
    label: "Navigation",
    historyIdea: "stay oriented on the page",
    detailIdea: "stay oriented on the page",
    interpretations: {
      high: "Users may miss the page path or spend effort trying to find their way.",
      medium: "Users may need extra orientation before reaching the main content.",
      low: "Navigation appears visible without distracting from the main content.",
    },
  },
};

function normalizeAttentionRiskLevel(value) {
  const riskLevel = String(value || "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(ATTENTION_RISK_ORDER, riskLevel)
    ? riskLevel
    : "medium";
}

function formatAttentionRiskLabel(riskLevel, fallback) {
  const cleanedFallback = String(fallback || "").trim();
  if (cleanedFallback) {
    return cleanedFallback;
  }
  return `${riskLevel.charAt(0).toUpperCase()}${riskLevel.slice(1)} risk`;
}

function normalizeElementType(item) {
  const rawKey = String(item?.key || "").trim().toLowerCase();
  const rawLabel = String(item?.label || "").trim().toLowerCase();
  return ELEMENT_TYPE_ALIASES[rawKey] || ELEMENT_TYPE_ALIASES[rawLabel] || rawKey || rawLabel || "other";
}

function deriveRiskLevelFromShare(elementType, rawShare) {
  const share = Math.max(0, Math.min(1, Number(rawShare) || 0));
  if (elementType === "headings") {
    if (share < 0.05) return "high";
    if (share < 0.1 || share > 0.25) return "medium";
    return "low";
  }
  if (elementType === "interactive") {
    if (share < 0.05) return "high";
    if (share < 0.12) return "medium";
    return "low";
  }
  if (elementType === "main_text") {
    if (share < 0.2) return "high";
    if (share < 0.35 || share > 0.65) return "medium";
    return "low";
  }
  if (elementType === "media") {
    if (share > 0.25) return "high";
    if (share > 0.1) return "medium";
    return "low";
  }
  if (elementType === "navigation") {
    if (share < 0.03 || share > 0.3) return "high";
    if (share > 0.15) return "medium";
    return "low";
  }
  if (share > 0.25) return "high";
  if (share > 0.12) return "medium";
  return "low";
}

function getElementInterpretation(elementType, riskLevel, fallback = "") {
  const configured = ELEMENT_EVIDENCE_COPY[elementType]?.interpretations?.[riskLevel];
  return configured || String(fallback || "").trim() || "Attention pattern needs checking against the page's intended user journey.";
}

function getRiskDrivers(summary) {
  const items = Array.isArray(summary?.attention_summary) ? summary.attention_summary : [];
  return items
    .map((item) => {
      const hitCount = Math.max(0, Number(item?.hit_count || 0));
      if (!hitCount) {
        return null;
      }
      const elementType = normalizeElementType(item);
      const configured = ELEMENT_EVIDENCE_COPY[elementType];
      const riskLevel = item?.risk_level
        ? normalizeAttentionRiskLevel(item.risk_level)
        : deriveRiskLevelFromShare(elementType, item?.share);
      return {
        elementType,
        label: configured?.label || String(item?.label || "Other"),
        riskLevel,
        riskLabel: formatAttentionRiskLabel(riskLevel, item?.risk_label),
        interpretation: getElementInterpretation(elementType, riskLevel, item?.risk_reason),
        idea: configured?.historyIdea || "",
        detailIdea: configured?.detailIdea || "",
      };
    })
    .filter(Boolean)
    .sort((a, b) => ATTENTION_RISK_ORDER[a.riskLevel] - ATTENTION_RISK_ORDER[b.riskLevel]);
}

function getOverallEvidenceRisk(elementRisks) {
  if (!elementRisks.length) {
    return null;
  }
  if (elementRisks.some((item) => item.riskLevel === "high")) {
    return "high";
  }
  if (elementRisks.some((item) => item.riskLevel === "medium")) {
    return "medium";
  }
  return "low";
}

function buildEvidenceSummary(elementRisks, { detail = false } = {}) {
  const actionable = elementRisks.filter((item) => item.riskLevel === "high");
  const mediumRisks = elementRisks.filter((item) => item.riskLevel === "medium");
  const selected = [...actionable, ...mediumRisks]
    .filter((item) => (detail ? item.detailIdea : item.idea))
    .slice(0, 2);

  if (!selected.length) {
    return elementRisks.length
      ? "Eye evidence does not show a major element-level attention risk."
      : EYE_EVIDENCE_DETAIL_FALLBACK;
  }

  const ideas = selected.map((item) => (detail ? item.detailIdea : item.idea));
  if (ideas.includes(detail ? "understand the page structure" : "understand the structure") && ideas.includes("find the next action")) {
    return detail
      ? "Users may struggle to understand the page structure and find the next action."
      : "Users may struggle to understand the structure and find the next action.";
  }
  if (ideas.length === 1) {
    return `Users may struggle to ${ideas[0]}.`;
  }
  return `Users may struggle to ${ideas[0]} and ${ideas[1]}.`;
}

function getHistoryEvidenceSummary(elementRisks) {
  return buildEvidenceSummary(elementRisks, { detail: false });
}

function getHeatmapEvidenceSummary(elementRisks) {
  return buildEvidenceSummary(elementRisks, { detail: true });
}

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

function EyeEvidenceDetailPanel({ summary }) {
  const riskDrivers = getRiskDrivers(summary);
  const overallRisk = getOverallEvidenceRisk(riskDrivers);
  const interpretation = getHeatmapEvidenceSummary(riskDrivers);

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
      </div>

      <div className="history-eye-detail-section">
        <p className="history-eye-detail-label">Interpretation:</p>
        <p className="history-eye-detail-copy">{interpretation}</p>
      </div>

      {riskDrivers.length ? (
        <div className="history-eye-detail-section">
          <p className="history-eye-detail-label">Risk drivers:</p>
          <ul className="history-eye-risk-list">
            {riskDrivers.map((item) => (
              <li key={`${item.elementType}-${item.label}`} className="history-eye-risk-item">
                <div className="history-eye-risk-title">
                  <span>{item.label}</span>
                  <span className={`history-risk-pill is-${item.riskLevel}`}>{item.riskLabel}</span>
                </div>
                <p>{item.interpretation}</p>
              </li>
            ))}
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
  const evidenceSummary = detail?.summary || {};

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
            <div className="history-heatmap-detail-layout">
              <div className="history-heatmap-panel">
              <p className="history-behavioral-modal-meta">
                Attention coverage: {Number(session.coverage_percent ?? 0).toFixed(1)}% · Gaze samples:{" "}
                {session.sample_count} · Duration: {formatDuration(session.duration_ms)}
              </p>
                <HeatmapGrid
                  gridCols={detail.grid_cols}
                  gridRows={detail.grid_rows}
                  cellCounts={detail.cell_counts}
                />
              </div>
              <EyeEvidenceDetailPanel summary={evidenceSummary} />
            </div>
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
  const riskDrivers = getRiskDrivers(summary);
  const evidenceSummary = getHistoryEvidenceSummary(riskDrivers);

  return (
    <div className="history-supporting-cell">
      <p className="history-supporting-available">Eye evidence available</p>
      <p className="history-supporting-summary">{evidenceSummary}</p>
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
        <strong className="history-analysis-name">{item.source_name}</strong>
        <small className="history-analysis-trace-id">ID: {formatReportTimestamp(item.created_at)}</small>
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
