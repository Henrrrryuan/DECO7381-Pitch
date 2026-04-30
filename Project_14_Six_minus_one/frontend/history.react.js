import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";

import {
  API_BASE,
  fetchJson,
  formatDate,
  formatReportTimestamp,
  formatShortId,
  saveDashboardSession,
} from "./common.js";

// This file is a progressive React migration for the History page only.
// The existing CSS classes are reused so the visual design stays consistent
// while the old manual DOM rendering is replaced with state-driven components.
const h = React.createElement;
const REPORT_PAGE_SIZE = 10;
const EYE_PAGE_SIZE = 25;
const DASHBOARD_HISTORY_CONTEXT_KEY = "cognilens.dashboard.history-context";
const DASHBOARD_HISTORY_ONCE_KEY = "cognilens.dashboard.history-once";

// Convert a saved history detail response into the session shape expected by
// dashboard.html. This keeps the full run metadata, so the Dashboard Report ID
// can display the same short ID shown in History.
function buildCurrentSession(detail) {
  const sourceName = detail.run?.source_name || "history-item";
  const sourceUrl = /^https?:\/\//i.test(sourceName) ? sourceName : "";
  return {
    current: {
      payload: {
        ...detail.analysis,
        run: detail.run,
      },
      html: detail.html_content || "",
      sourceName,
      sourceUrl,
      savedAt: detail.run?.created_at || new Date().toISOString(),
    },
    previous: null,
    sourceUrl,
  };
}

// Shared formatting helpers for the History React components.
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

// Build API URLs for server-side pagination. The backend returns one page of
// records plus a total count; React stores only the current page in state.
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

// Top-level page component. It owns the History page state:
// search query, report pagination, eye-evidence pagination, loading states,
// and the action for opening a saved report in the Dashboard.
function HistoryApp() {
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [reportPage, setReportPage] = useState(1);
  const [eyePage, setEyePage] = useState(1);
  const [reports, setReports] = useState({ items: [], total: 0 });
  const [eyeSessions, setEyeSessions] = useState({ items: [], total: 0 });
  const [reportStatus, setReportStatus] = useState({ loading: true, error: "" });
  const [eyeStatus, setEyeStatus] = useState({ loading: true, error: "" });
  const [eyeModalOpen, setEyeModalOpen] = useState(false);

  // Load report history whenever the submitted query or report page changes.
  // AbortController prevents old requests from updating the UI after a newer
  // search/page request has already started.
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

  // Load eye-tracking evidence independently from report history. It does not
  // follow the left search query, so the right panel remains a stable summary.
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

  // Search is submitted explicitly. This avoids reloading both tables on every
  // keystroke and resets both pagers back to page 1 for the new result set.
  const runSearch = useCallback((event) => {
    event?.preventDefault();
    setQuery(queryInput.trim());
    setReportPage(1);
  }, [queryInput]);

  // Open a saved report by fetching its full detail, saving it to sessionStorage,
  // and then navigating to dashboard.html.
  const openReport = useCallback(async (runId) => {
    const detail = await fetchJson(`${API_BASE}/history/${runId}`);
    saveDashboardSession(buildCurrentSession(detail));
    sessionStorage.setItem(DASHBOARD_HISTORY_CONTEXT_KEY, runId);
    sessionStorage.setItem(DASHBOARD_HISTORY_ONCE_KEY, "1");
    window.location.href = "./dashboard.html?from=history";
  }, []);

  useEffect(() => {
    if (!eyeModalOpen) {
      return undefined;
    }
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setEyeModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [eyeModalOpen]);

  return h(React.Fragment, null,
    h(HistoryHero),
    h(HistorySearch, {
      queryInput,
      onQueryInputChange: setQueryInput,
      onSearch: runSearch,
    }),
    h("div", { className: "history-grid" },
      h(ReportHistoryPanel, {
        items: reports.items,
        total: reports.total,
        page: reportPage,
        status: reportStatus,
        query,
        onPageChange: setReportPage,
        onOpenReport: openReport,
      }),
      h(EyeEvidenceSummaryCard, {
        items: eyeSessions.items,
        total: eyeSessions.total,
        status: eyeStatus,
        onOpenModal: () => setEyeModalOpen(true),
      }),
    ),
    eyeModalOpen && h(EyeEvidenceModal, {
      items: eyeSessions.items,
      total: eyeSessions.total,
      page: eyePage,
      status: eyeStatus,
      onPageChange: setEyePage,
      onClose: () => setEyeModalOpen(false),
    }),
  );
}

// Static heading and description for the page. Keeping this as a component makes
// the main HistoryApp easier to read and mirrors how React pages are usually split.
function HistoryHero() {
  return h("section", { className: "history-hero" },
    h("h1", null, "Previous Analyses"),
  );
}

// Controlled search form. The typed value is local to the input state until the
// user submits, then HistoryApp applies it as the active API query.
function HistorySearch({ queryInput, onQueryInputChange, onSearch }) {
  return h("section", { className: "history-toolbar", "aria-label": "History search" },
    h("form", { className: "history-search-row", onSubmit: onSearch },
      h("input", {
        id: "historySearchInput",
        className: "history-search-input",
        type: "search",
        placeholder: "Enter a file name or report ID",
        autoComplete: "off",
        value: queryInput,
        onChange: (event) => onQueryInputChange(event.target.value),
      }),
      h("button", {
        id: "historySearchButton",
        className: "history-search-button",
        type: "submit",
        "aria-label": "Search reports",
      }, h("span", { "aria-hidden": "true" }, "🔍")),
    ),
  );
}

// Left-hand panel for saved analysis reports. It delegates row rendering and
// pagination so this component only describes the report table structure.
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

  return h("section", { className: "history-list-shell" },
    h("div", { className: "history-table-head" },
      h("span", null, "Report ID"),
      h("span", null, "File"),
      h("span", null, "Date"),
      h("span", null, "Overall"),
      h("span", null, "Actions"),
    ),
    h("div", { id: "historyList", className: "history-table-body" },
      h(ReportRows, {
        items,
        status,
        emptyMessage,
        onOpenReport,
      }),
    ),
    h(Pagination, {
      id: "historyPagination",
      ariaLabel: "Report history pagination",
      page,
      total,
      itemLabel: "reports",
      pageSize: REPORT_PAGE_SIZE,
      onPageChange,
    }),
  );
}

// Render the body of the report table. Loading, error, empty, and data states
// are handled in one place so the table shell does not need conditional markup.
function ReportRows({ items, status, emptyMessage, onOpenReport }) {
  if (status.loading) {
    return h("p", { className: "history-empty" }, "Loading analysis history...");
  }

  if (status.error) {
    return h("p", { className: "history-empty" }, status.error);
  }

  if (!items.length) {
    return h("p", { className: "history-empty" }, emptyMessage);
  }

  return items.map((item) => h("article", { className: "history-row", key: item.run_id },
    h("span", { className: "history-cell history-id", title: item.run_id },
      formatReportTimestamp(item.created_at),
    ),
    h("span", { className: "history-cell title", title: item.source_name }, item.source_name),
    h("span", { className: "history-cell" }, formatDate(item.created_at)),
    h("span", { className: "history-cell score" }, item.overall_score),
    h("span", { className: "history-cell action" },
      h("div", { className: "history-actions" },
        h("button", {
          className: "history-open-btn",
          type: "button",
          "data-run-id": item.run_id,
          onClick: () => onOpenReport(item.run_id),
        }, "View"),
      ),
    ),
  ));
}

// Right-hand panel for optional eye-tracking evidence sessions. These records
// are supporting evidence linked back to Report IDs rather than primary reports.
function EyeEvidenceSummaryCard({
  items,
  total,
  status,
  onOpenModal,
}) {
  const latestSession = items[0] || null;
  const averageCoverage = useMemo(() => {
    if (!items.length) {
      return "0.0";
    }
    const sum = items.reduce(
      (acc, item) => acc + Number(item.coverage_percent ?? 0),
      0,
    );
    return (sum / items.length).toFixed(1);
  }, [items]);

  return h("section", { className: "history-list-shell eye-history-summary-shell" },
    h("div", { className: "history-section-header history-section-header-compact" },
      h("div", null,
        h("p", { className: "upload-kicker" }, "Supporting Evidence"),
        h("h2", null, "Eye-Tracking Evidence"),
      ),
    ),
    h("div", { className: "history-evidence-summary-grid" },
      h("article", { className: "history-evidence-summary-card" },
        h("span", { className: "history-evidence-summary-label" }, "Total sessions"),
        h("strong", null, String(total || 0)),
      ),
      h("article", { className: "history-evidence-summary-card" },
        h("span", { className: "history-evidence-summary-label" }, "Avg coverage (this page)"),
        h("strong", null, `${averageCoverage}%`),
      ),
    ),
    h("div", { className: "history-evidence-latest" },
      h("h3", null, "Latest evidence session"),
      status.loading
        ? h("p", { className: "history-empty" }, "Loading eye-tracking evidence...")
        : status.error
          ? h("p", { className: "history-empty" }, status.error)
          : latestSession
            ? h("div", { className: "history-evidence-latest-meta" },
              h("strong", { title: latestSession.source_name }, latestSession.source_name),
              h("span", null, `Evidence ${formatShortId(latestSession.session_id, "E-")}`),
              h("span", null, `Coverage ${Number(latestSession.coverage_percent ?? 0).toFixed(1)}%`),
              h("span", null, formatDate(latestSession.created_at)),
            )
            : h("p", { className: "history-empty" }, "No eye-tracking evidence sessions have been saved yet."),
    ),
    h("div", { className: "history-evidence-actions" },
      h("button", {
        type: "button",
        className: "history-open-btn",
        onClick: onOpenModal,
      }, "View all evidence"),
    ),
  );
}

function EyeEvidenceModal({
  items,
  total,
  page,
  status,
  onPageChange,
  onClose,
}) {
  const emptyMessage = "No eye-tracking evidence sessions have been saved yet.";

  return h("div", { className: "history-evidence-modal-backdrop", role: "presentation", onClick: onClose },
    h("section", {
      className: "history-list-shell eye-history-shell history-evidence-modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "All eye-tracking evidence sessions",
      onClick: (event) => event.stopPropagation(),
    },
    h("div", { className: "history-section-header" },
      h("div", { className: "history-modal-title-wrap" },
        h("p", { className: "upload-kicker" }, "Supporting Evidence"),
        h("h2", null, "All Eye-Tracking Evidence Sessions"),
      ),
      h("button", {
        type: "button",
        className: "history-modal-close-btn",
        "aria-label": "Close evidence drawer",
        onClick: onClose,
      }, "Close"),
    ),
    h("div", { className: "history-eye-table-head" },
      h("span", null, "Evidence ID"),
      h("span", null, "Page"),
      h("span", null, "Coverage"),
    ),
    h("div", { id: "eyeHistoryList", className: "history-table-body" },
      h(EyeRows, { items, status, emptyMessage }),
    ),
    h(Pagination, {
      id: "eyeHistoryPagination",
      ariaLabel: "Eye-tracking evidence pagination",
      page,
      total,
      itemLabel: "sessions",
      pageSize: EYE_PAGE_SIZE,
      onPageChange,
    }),
    ),
  );
}

// Render saved eye-tracking sessions. Each row shows the short Evidence ID,
// page/source metadata, coverage, and the related short Report ID when available.
function EyeRows({ items, status, emptyMessage }) {
  if (status.loading) {
    return h("p", { className: "history-empty" }, "Loading eye-tracking evidence...");
  }

  if (status.error) {
    return h("p", { className: "history-empty" }, status.error);
  }

  if (!items.length) {
    return h("p", { className: "history-empty" }, emptyMessage);
  }

  return items.map((item) => {
    const coverage = Number(item.coverage_percent ?? 0).toFixed(1);
    const sessionMeta = `${formatDate(item.created_at)} / ${item.sample_count} samples / ${formatDuration(item.duration_ms)}`;

    return h("article", { className: "history-eye-row", key: item.session_id },
      h("span", { className: "history-cell history-id", title: item.session_id },
        formatShortId(item.session_id, "E-"),
      ),
      h("span", { className: "history-cell history-eye-target" },
        h("strong", { title: item.source_name }, item.source_name),
        item.target_url
          ? h("small", { title: item.target_url }, item.target_url)
          : h("small", null, "No target URL saved"),
        h("small", null, sessionMeta),
      ),
      h("span", { className: "history-cell score" }, `${coverage}%`),
    );
  });
}

// Reusable pager used by both tables. The parent owns the actual page state,
// while this component handles the Previous/Next buttons and typed page jump.
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

  return h("div", { id, className: "history-pagination", "aria-label": ariaLabel },
    h("div", { className: "history-pagination-summary" },
      h("strong", null, `Page ${safePage} / ${totalPages}`),
      h("span", null, `${startItem}-${endItem} of ${total} ${itemLabel}`),
    ),
    h("div", { className: "history-pagination-controls" },
      h("button", {
        className: "history-page-btn",
        type: "button",
        disabled: safePage <= 1,
        onClick: () => onPageChange(Math.max(1, safePage - 1)),
      }, "Previous"),
      h("span", { className: "history-pagination-page-indicator", "aria-live": "polite" }, `${safePage} / ${totalPages}`),
      h("button", {
        className: "history-page-btn",
        type: "button",
        disabled: safePage >= totalPages,
        onClick: () => onPageChange(Math.min(totalPages, safePage + 1)),
      }, "Next"),
    ),
  );
}

// Mount the React tree into the small placeholder left in history.html.
const root = createRoot(document.getElementById("historyRoot"));
root.render(h(HistoryApp));
