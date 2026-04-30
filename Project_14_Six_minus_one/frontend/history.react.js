import React, {
  useCallback,
  useEffect,
  useState,
} from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";

import {
  API_BASE,
  fetchJson,
  formatDate,
  formatShortId,
  saveDashboardSession,
} from "./common.js";

// This file is a progressive React migration for the History page only.
// The existing CSS classes are reused so the visual design stays consistent
// while the old manual DOM rendering is replaced with state-driven components.
const h = React.createElement;
const PAGE_SIZE = 25;
const AUTO_PRINT_STORAGE_KEY = "cognilens.dashboard.autoPrint";

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

function getTotalPages(total) {
  return Math.max(1, Math.ceil((Number(total) || 0) / PAGE_SIZE));
}

function getPageOffset(page) {
  return (Math.max(1, Number(page) || 1) - 1) * PAGE_SIZE;
}

// Build API URLs for server-side pagination. The backend returns one page of
// records plus a total count; React stores only the current page in state.
function buildPagedUrl(path, page, query) {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(getPageOffset(page)),
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

  // Load report history whenever the submitted query or report page changes.
  // AbortController prevents old requests from updating the UI after a newer
  // search/page request has already started.
  useEffect(() => {
    const controller = new AbortController();
    setReportStatus({ loading: true, error: "" });

    fetchJson(buildPagedUrl("/history", reportPage, query), { signal: controller.signal })
      .then((payload) => {
        const total = Number(payload.total ?? payload.items?.length ?? 0) || 0;
        const totalPages = getTotalPages(total);
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

  // Load eye-tracking evidence independently from report history. It uses the
  // same query text but keeps its own page number and loading state.
  useEffect(() => {
    const controller = new AbortController();
    setEyeStatus({ loading: true, error: "" });

    fetchJson(buildPagedUrl("/eye/sessions", eyePage, query), { signal: controller.signal })
      .then((payload) => {
        const total = Number(payload.total ?? payload.items?.length ?? 0) || 0;
        const totalPages = getTotalPages(total);
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
  }, [query, eyePage]);

  // Search is submitted explicitly. This avoids reloading both tables on every
  // keystroke and resets both pagers back to page 1 for the new result set.
  const runSearch = useCallback((event) => {
    event?.preventDefault();
    setQuery(queryInput.trim());
    setReportPage(1);
    setEyePage(1);
  }, [queryInput]);

  // Open a saved report by fetching its full detail, saving it to sessionStorage,
  // and then navigating to dashboard.html. The print action sets a short-lived
  // flag so the Dashboard can open the browser print flow after loading.
  const openReport = useCallback(async (runId, action) => {
    const detail = await fetchJson(`${API_BASE}/history/${runId}`);
    saveDashboardSession(buildCurrentSession(detail));
    if (action === "print") {
      sessionStorage.setItem(AUTO_PRINT_STORAGE_KEY, "true");
    } else {
      sessionStorage.removeItem(AUTO_PRINT_STORAGE_KEY);
    }
    window.location.href = "./dashboard.html";
  }, []);

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
      h(EyeHistoryPanel, {
        items: eyeSessions.items,
        total: eyeSessions.total,
        page: eyePage,
        status: eyeStatus,
        query,
        onPageChange: setEyePage,
      }),
    ),
  );
}

// Static heading and description for the page. Keeping this as a component makes
// the main HistoryApp easier to read and mirrors how React pages are usually split.
function HistoryHero() {
  return h("section", { className: "history-hero" },
    h("p", { className: "upload-kicker" }, "History"),
    h("h1", null, "Previous Analyses"),
    h("p", { className: "history-description" },
      "Review recent submissions and reopen a previous analysis in the dashboard.",
    ),
  );
}

// Controlled search form. The typed value is local to the input state until the
// user submits, then HistoryApp applies it as the active API query.
function HistorySearch({ queryInput, onQueryInputChange, onSearch }) {
  return h("section", { className: "history-toolbar", "aria-label": "History search" },
    h("label", { className: "history-search-label", htmlFor: "historySearchInput" },
      "Search by file name, report ID, or evidence session ID",
    ),
    h("form", { className: "history-search-row", onSubmit: onSearch },
      h("input", {
        id: "historySearchInput",
        className: "history-search-input",
        type: "search",
        placeholder: "Enter a file name, report ID, or evidence session ID",
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
      formatShortId(item.run_id, "R-"),
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
          "data-action": "open",
          onClick: () => onOpenReport(item.run_id, "open"),
        }, "View"),
        h("button", {
          className: "history-print-btn",
          type: "button",
          "data-run-id": item.run_id,
          "data-action": "print",
          title: "Open this record and print it",
          onClick: () => onOpenReport(item.run_id, "print"),
        }, h("span", { "aria-hidden": "true" }, "Print")),
      ),
    ),
  ));
}

// Right-hand panel for optional eye-tracking evidence sessions. These records
// are supporting evidence linked back to Report IDs rather than primary reports.
function EyeHistoryPanel({
  items,
  total,
  page,
  status,
  query,
  onPageChange,
}) {
  const emptyMessage = query
    ? "No eye-tracking evidence sessions match the current search."
    : "No eye-tracking evidence sessions have been saved yet.";

  return h("section", { className: "history-list-shell eye-history-shell" },
    h("div", { className: "history-section-header" },
      h("div", null,
        h("p", { className: "upload-kicker" }, "Supporting Evidence"),
        h("h2", null, "Eye-Tracking Evidence Sessions"),
      ),
      h("p", { className: "history-section-copy" },
        "Review saved gaze sessions as supporting evidence for attention patterns, information overload, and related analysis runs.",
      ),
    ),
    h("div", { className: "history-eye-table-head" },
      h("span", null, "Evidence ID"),
      h("span", null, "Page"),
      h("span", null, "Coverage"),
      h("span", null, "Report ID"),
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
      onPageChange,
    }),
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
    const relatedRun = item.run_id ? formatShortId(item.run_id, "R-") : "—";
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
      h("span", { className: "history-cell history-id", title: item.run_id || "" }, relatedRun),
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
  onPageChange,
}) {
  const totalPages = getTotalPages(total);
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const startItem = total ? getPageOffset(safePage) + 1 : 0;
  const endItem = Math.min(getPageOffset(safePage) + PAGE_SIZE, total);
  const [jumpPage, setJumpPage] = useState(String(safePage));

  useEffect(() => {
    setJumpPage(String(safePage));
  }, [safePage, totalPages]);

  const jumpToPage = () => {
    const nextPage = Math.min(Math.max(1, Number(jumpPage) || safePage), totalPages);
    onPageChange(nextPage);
  };

  return h("div", { id, className: "history-pagination", "aria-label": ariaLabel },
    h("div", { className: "history-pagination-summary" },
      h("strong", null, `Page ${safePage} of ${totalPages}`),
      h("span", null, `${startItem}-${endItem} of ${total} ${itemLabel}`),
    ),
    h("div", { className: "history-pagination-controls" },
      h("button", {
        className: "history-page-btn",
        type: "button",
        disabled: safePage <= 1,
        onClick: () => onPageChange(Math.max(1, safePage - 1)),
      }, "Previous"),
      h("label", { className: "history-page-jump" },
        h("span", null, "Go to"),
        h("input", {
          className: "history-page-input",
          type: "number",
          min: "1",
          max: String(totalPages),
          value: jumpPage,
          inputMode: "numeric",
          onChange: (event) => setJumpPage(event.target.value),
          onKeyDown: (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              jumpToPage();
            }
          },
        }),
      ),
      h("button", {
        className: "history-page-btn",
        type: "button",
        onClick: jumpToPage,
      }, "Go"),
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
