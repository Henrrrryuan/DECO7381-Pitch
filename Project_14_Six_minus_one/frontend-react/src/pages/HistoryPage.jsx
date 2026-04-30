import { useCallback, useEffect, useState } from "react";

import {
  fetchEyeHistory,
  fetchReportDetail,
  fetchReportHistory,
} from "../api/historyApi.js";
import { AppNav } from "../components/AppNav.jsx";
import { EyeHistoryPanel } from "../components/history/EyeHistoryPanel.jsx";
import { HistoryHero } from "../components/history/HistoryHero.jsx";
import { HistorySearch } from "../components/history/HistorySearch.jsx";
import { ReportHistoryPanel } from "../components/history/ReportHistoryPanel.jsx";
import {
  buildCurrentSession,
  getTotalPages,
  saveDashboardSession,
} from "../utils/historyUtils.js";

const PAGE_SIZE = 25;
const AUTO_PRINT_STORAGE_KEY = "cognilens.dashboard.autoPrint";

// Page controller for the Vite version of the History page.
//
// This file owns the workflow logic for the whole page:
// - It stores search text, submitted search text, pagination state, loaded data,
//   and loading/error status.
// - It calls api/historyApi.js to load report history, eye-tracking evidence,
//   and full report details.
// - It passes data and callback functions into presentation components under
//   components/history/.
// - It uses utils/historyUtils.js to prepare a selected report for the older
//   dashboard.html page.
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
      pageSize: PAGE_SIZE,
      abortSignal: reportHistoryRequestController.signal,
    })
      .then((reportHistoryPayload) => {
        const totalReports = Number(reportHistoryPayload.total ?? reportHistoryPayload.items?.length ?? 0) || 0;
        const totalPages = getTotalPages(totalReports, PAGE_SIZE);
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

  // Fetch eye-tracking evidence separately. It uses the same submitted search
  // query, but it keeps independent pagination so users can browse reports and
  // evidence sessions without forcing both tables onto the same page. This
  // effect calls fetchEyeHistory from api/historyApi.js, then passes the result
  // into EyeHistoryPanel.jsx through eyeEvidenceHistory state.
  useEffect(() => {
    const eyeEvidenceRequestController = new AbortController();
    setEyeEvidenceStatus({ loading: true, error: "" });

    fetchEyeHistory({
      pageNumber: eyeEvidencePage,
      searchQuery: submittedSearchQuery,
      pageSize: PAGE_SIZE,
      abortSignal: eyeEvidenceRequestController.signal,
    })
      .then((eyeEvidencePayload) => {
        const totalEyeSessions = Number(eyeEvidencePayload.total ?? eyeEvidencePayload.items?.length ?? 0) || 0;
        const totalPages = getTotalPages(totalEyeSessions, PAGE_SIZE);
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
  }, [submittedSearchQuery, eyeEvidencePage]);

  // Callback passed into HistorySearch.jsx as onSearch. It runs when the user
  // submits the search form. Updating submittedSearchQuery triggers both useEffect
  // blocks above, so both tables reload with the same search term.
  const runSearch = useCallback((event) => {
    event.preventDefault();
    setSubmittedSearchQuery(queryInput.trim());
    setReportPage(1);
    setEyeEvidencePage(1);
  }, [queryInput]);

  // Callback passed into ReportRows.jsx through ReportHistoryPanel.jsx as
  // onOpenReport. It loads full report detail through api/historyApi.js, converts
  // it with historyUtils.js, stores it in sessionStorage, and then opens the
  // existing dashboard.html page on port 8001.
  const openReport = useCallback(async (reportRunId, requestedAction) => {
    const reportDetail = await fetchReportDetail(reportRunId);
    saveDashboardSession(buildCurrentSession(reportDetail));
    if (requestedAction === "print") {
      sessionStorage.setItem(AUTO_PRINT_STORAGE_KEY, "true");
    } else {
      sessionStorage.removeItem(AUTO_PRINT_STORAGE_KEY);
    }
    window.location.href = "http://127.0.0.1:8001/dashboard.html";
  }, []);

  return (
    <>
      <AppNav />
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
            pageSize={PAGE_SIZE}
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
            pageSize={PAGE_SIZE}
            status={eyeEvidenceStatus}
            searchQuery={submittedSearchQuery}
            onPageChange={setEyeEvidencePage}
          />
        </div>
      </main>
    </>
  );
}
