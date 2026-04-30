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

// HistoryPage is the page shell for the Vite version of the History page.
// It owns data fetching, pagination state, search state, loading/error states,
// and the action that opens a saved report in the existing Dashboard.
export function HistoryPage() {
  const [queryInput, setQueryInput] = useState("");
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState("");
  const [reportPage, setReportPage] = useState(1);
  const [eyeEvidencePage, setEyeEvidencePage] = useState(1);
  const [reportHistory, setReportHistory] = useState({ reportItems: [], totalReports: 0 });
  const [eyeEvidenceHistory, setEyeEvidenceHistory] = useState({
    eyeSessionItems: [],
    totalEyeSessions: 0,
  });
  const [reportStatus, setReportStatus] = useState({ loading: true, error: "" });
  const [eyeEvidenceStatus, setEyeEvidenceStatus] = useState({ loading: true, error: "" });

  // Fetch report history whenever the submitted query or report page changes.
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
  // evidence sessions without forcing both tables onto the same page.
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

  // Only submit search when the form is sent. This avoids reloading both tables
  // on every keystroke and resets both pagers to the first page.
  const runSearch = useCallback((event) => {
    event.preventDefault();
    setSubmittedSearchQuery(queryInput.trim());
    setReportPage(1);
    setEyeEvidencePage(1);
  }, [queryInput]);

  // The Vite History page still opens the existing Dashboard on port 8001.
  // It stores the full selected report in sessionStorage before navigating.
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
        <HistorySearch
          queryInput={queryInput}
          onQueryInputChange={setQueryInput}
          onSearch={runSearch}
        />
        <div className="history-grid">
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
