import { useCallback, useEffect, useState } from "react";

import {
  fetchEyeHistory,
  fetchReportHistory,
} from "../api/historyApi.js";
import { AppNav } from "../components/AppNav.jsx";
import { EyeHistoryPanel } from "../components/history/EyeHistoryPanel.jsx";
import { HistoryHero } from "../components/history/HistoryHero.jsx";
import { HistorySearch } from "../components/history/HistorySearch.jsx";
import { ReportHistoryPanel } from "../components/history/ReportHistoryPanel.jsx";
import {
  DASHBOARD_HISTORY_CONTEXT_KEY,
  DASHBOARD_HISTORY_ONCE_KEY,
  getTotalPages,
} from "../utils/historyUtils.js";

const REPORT_PAGE_SIZE = 10;
const EYE_PAGE_SIZE = 25;

// Page controller for the Vite version of the History page.
//
// This file owns the workflow logic for the whole page:
// - It stores search text, submitted search text, pagination state, loaded data,
//   and loading/error status.
// - It calls api/historyApi.js to load report history and optional
//   eye-tracking evidence.
// - It passes data and callback functions into presentation components under
//   components/history/.
// - It uses utils/historyUtils.js storage keys to tell the older dashboard.html
//   page which saved report should be reopened.
// Child components render UI and call callbacks, but this page decides what
// data should be loaded and what happens after user actions.
export function HistoryPage() {
  // queryInput is the text currently inside HistorySearch.jsx. It changes on
  // every keystroke, but it does not trigger API requests immediately.
  const [queryInput, setQueryInput] = useState("");

  // submittedSearchQuery is the text actually used by api/historyApi.js. It is
  // updated only when HistorySearch.jsx submits the form.
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState("");

  // The two tables keep separate page numbers because report runs and
  // eye-tracking sessions can have different totals.
  const [reportPage, setReportPage] = useState(1);
  const [eyeEvidencePage, setEyeEvidencePage] = useState(1);
  const [eyeEvidenceModalOpen, setEyeEvidenceModalOpen] = useState(false);

  // Loaded table data. ReportHistoryPanel.jsx and EyeHistoryPanel.jsx receive
  // these values as props and never fetch data directly.
  const [reportHistory, setReportHistory] = useState({ reportItems: [], totalReports: 0 });
  const [eyeEvidenceHistory, setEyeEvidenceHistory] = useState({
    eyeSessionItems: [],
    totalEyeSessions: 0,
  });

  // Loading and error states are stored beside the data so row components can
  // render loading, empty, error, or data states consistently.
  const [reportStatus, setReportStatus] = useState({ loading: true, error: "" });
  const [eyeEvidenceStatus, setEyeEvidenceStatus] = useState({ loading: true, error: "" });

  // Fetch report history whenever the submitted query or report page changes.
  // This effect calls fetchReportHistory from api/historyApi.js, then passes the
  // result into ReportHistoryPanel.jsx through reportHistory state. The
  // AbortController stops older requests from updating state after the user has
  // already triggered a newer search or page change.
  useEffect(() => {
    const reportHistoryRequestController = new AbortController();
    setReportStatus({ loading: true, error: "" });

    fetchReportHistory({
      pageNumber: reportPage,
      searchQuery: submittedSearchQuery,
      pageSize: REPORT_PAGE_SIZE,
      abortSignal: reportHistoryRequestController.signal,
    })
      .then((reportHistoryPayload) => {
        const totalReports = Number(reportHistoryPayload.total ?? reportHistoryPayload.items?.length ?? 0) || 0;
        const totalPages = getTotalPages(totalReports, REPORT_PAGE_SIZE);
        if (reportPage > totalPages) {
          setReportPage(totalPages);
          return;
        }

        setReportHistory({ reportItems: reportHistoryPayload.items || [], totalReports });
        setReportStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setReportHistory({ reportItems: [], totalReports: 0 });
        setReportStatus({ loading: false, error: error.message });
      });

    return () => reportHistoryRequestController.abort();
  }, [submittedSearchQuery, reportPage]);

  // Fetch eye-tracking evidence separately from report search. The teammate's
  // latest progressive History page keeps evidence as a stable supporting
  // summary, so changing the report search text should not hide evidence
  // records from the right-side panel or its modal.
  useEffect(() => {
    const eyeEvidenceRequestController = new AbortController();
    setEyeEvidenceStatus({ loading: true, error: "" });

    fetchEyeHistory({
      pageNumber: eyeEvidencePage,
      searchQuery: "",
      pageSize: EYE_PAGE_SIZE,
      abortSignal: eyeEvidenceRequestController.signal,
    })
      .then((eyeEvidencePayload) => {
        const totalEyeSessions = Number(eyeEvidencePayload.total ?? eyeEvidencePayload.items?.length ?? 0) || 0;
        const totalPages = getTotalPages(totalEyeSessions, EYE_PAGE_SIZE);
        if (eyeEvidencePage > totalPages) {
          setEyeEvidencePage(totalPages);
          return;
        }

        setEyeEvidenceHistory({
          eyeSessionItems: eyeEvidencePayload.items || [],
          totalEyeSessions,
        });
        setEyeEvidenceStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setEyeEvidenceHistory({ eyeSessionItems: [], totalEyeSessions: 0 });
        setEyeEvidenceStatus({ loading: false, error: error.message });
      });

    return () => eyeEvidenceRequestController.abort();
  }, [eyeEvidencePage]);

  // Callback passed into HistorySearch.jsx as onSearch. It runs when the user
  // submits the search form. Updating submittedSearchQuery triggers only the
  // report-history effect above; eye-tracking evidence stays available as
  // optional supporting evidence instead of being filtered by report search.
  const runSearch = useCallback((event) => {
    event.preventDefault();
    setSubmittedSearchQuery(queryInput.trim());
    setReportPage(1);
  }, [queryInput]);

  // Callback passed into ReportRows.jsx through ReportHistoryPanel.jsx as
  // onOpenReport. The dashboard page now receives the selected run_id and uses
  // its own history fallback loader to fetch the saved report. This keeps the
  // History page from overwriting an active dashboard session.
  const openReport = useCallback((reportRunId) => {
    sessionStorage.setItem(DASHBOARD_HISTORY_CONTEXT_KEY, reportRunId);
    sessionStorage.setItem(DASHBOARD_HISTORY_ONCE_KEY, "1");
    window.location.href = `http://127.0.0.1:8001/dashboard.html?from=history&run=${encodeURIComponent(reportRunId)}`;
  }, []);

  return (
    <>
      <AppNav activePage="history" />
      <main className="history-page">
        <HistoryHero />
        {/* HistorySearch.jsx displays the input, while runSearch above performs the search workflow. */}
        <HistorySearch
          queryInput={queryInput}
          onQueryInputChange={setQueryInput}
          onSearch={runSearch}
        />
        <div className="history-grid">
          {/* ReportHistoryPanel.jsx renders report data loaded by the report history effect above. */}
          <ReportHistoryPanel
            reportItems={reportHistory.reportItems}
            totalReports={reportHistory.totalReports}
            currentPage={reportPage}
            pageSize={REPORT_PAGE_SIZE}
            status={reportStatus}
            searchQuery={submittedSearchQuery}
            onPageChange={setReportPage}
            onOpenReport={openReport}
          />
          {/* EyeHistoryPanel.jsx renders eye-session data loaded by the eye evidence effect above. */}
          <EyeHistoryPanel
            eyeSessionItems={eyeEvidenceHistory.eyeSessionItems}
            totalEyeSessions={eyeEvidenceHistory.totalEyeSessions}
            currentPage={eyeEvidencePage}
            pageSize={EYE_PAGE_SIZE}
            status={eyeEvidenceStatus}
            onPageChange={setEyeEvidencePage}
            isModalOpen={eyeEvidenceModalOpen}
            onOpenModal={() => setEyeEvidenceModalOpen(true)}
            onCloseModal={() => setEyeEvidenceModalOpen(false)}
          />
        </div>
      </main>
    </>
  );
}
