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

// HistoryPage is the page shell. It owns data fetching, pagination state,
// search state, and the action for opening a saved report in the old Dashboard.
export function HistoryPage() {
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

    fetchReportHistory({
      page: reportPage,
      query,
      pageSize: PAGE_SIZE,
      signal: controller.signal,
    })
      .then((payload) => {
        const total = Number(payload.total ?? payload.items?.length ?? 0) || 0;
        const totalPages = getTotalPages(total, PAGE_SIZE);
        if (reportPage > totalPages) {
          setReportPage(totalPages);
          return;
        }

        setReports({ items: payload.items || [], total });
        setReportStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setReports({ items: [], total: 0 });
        setReportStatus({ loading: false, error: error.message });
      });

    return () => controller.abort();
  }, [query, reportPage]);

  useEffect(() => {
    const controller = new AbortController();
    setEyeStatus({ loading: true, error: "" });

    fetchEyeHistory({
      page: eyePage,
      query,
      pageSize: PAGE_SIZE,
      signal: controller.signal,
    })
      .then((payload) => {
        const total = Number(payload.total ?? payload.items?.length ?? 0) || 0;
        const totalPages = getTotalPages(total, PAGE_SIZE);
        if (eyePage > totalPages) {
          setEyePage(totalPages);
          return;
        }

        setEyeSessions({ items: payload.items || [], total });
        setEyeStatus({ loading: false, error: "" });
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setEyeSessions({ items: [], total: 0 });
        setEyeStatus({ loading: false, error: error.message });
      });

    return () => controller.abort();
  }, [query, eyePage]);

  const runSearch = useCallback((event) => {
    event.preventDefault();
    setQuery(queryInput.trim());
    setReportPage(1);
    setEyePage(1);
  }, [queryInput]);

  const openReport = useCallback(async (runId, action) => {
    const detail = await fetchReportDetail(runId);
    saveDashboardSession(buildCurrentSession(detail));
    if (action === "print") {
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
            items={reports.items}
            total={reports.total}
            page={reportPage}
            pageSize={PAGE_SIZE}
            status={reportStatus}
            query={query}
            onPageChange={setReportPage}
            onOpenReport={openReport}
          />
          <EyeHistoryPanel
            items={eyeSessions.items}
            total={eyeSessions.total}
            page={eyePage}
            pageSize={PAGE_SIZE}
            status={eyeStatus}
            query={query}
            onPageChange={setEyePage}
          />
        </div>
      </main>
    </>
  );
}
