import { useCallback, useEffect, useMemo, useState } from "react";

import {
  analyzeRenderedDashboardHtml,
  chatWithDashboardAssistant,
  fetchDashboardReportDetail,
} from "../api/dashboardApi.js";
import { AppNav } from "../components/AppNav.jsx";
import { AssistantFloatingPanel } from "../components/dashboard/AssistantFloatingPanel.jsx";
import { DashboardSidebar } from "../components/dashboard/DashboardSidebar.jsx";
import { DashboardWorkspace } from "../components/dashboard/DashboardWorkspace.jsx";
import { buildAssistantContext } from "../utils/dashboard/assistantContext.js";
import {
  buildAnalysisView,
  buildDashboardSessionFromReportDetail,
  getHistoryReportRunIdentifierFromUrl,
  normalizeDashboardSession,
} from "../utils/dashboard/dashboardSession.js";
import {
  findIssueRecordByIdentifier,
} from "../utils/dashboard/issueRecords.js";
import {
  getActiveProfileDimensionEntries,
  getActiveProfileLabel,
} from "../utils/dashboard/profileScoring.js";
import {
  DASHBOARD_SESSION_STORAGE_KEY,
  loadCurrentDashboardSession,
} from "../utils/uploadUtils.js";

const DEFAULT_SIDEBAR_WIDTH = 360;
const MINIMUM_SIDEBAR_WIDTH = 320;
const MAXIMUM_SIDEBAR_WIDTH = 560;
const SIDEBAR_COLLAPSED_STORAGE_KEY = "cognilens.sidebar.collapsed";
const SIDEBAR_WIDTH_STORAGE_KEY = "cognilens.sidebar.width";
const INITIAL_ASSISTANT_MESSAGE = {
  role: "assistant",
  content: "Ask me how to reduce information overload, improve readability, or fix specific issues.",
};

function clampSidebarWidth(width) {
  return Math.max(MINIMUM_SIDEBAR_WIDTH, Math.min(MAXIMUM_SIDEBAR_WIDTH, width));
}

function loadStoredSidebarWidth() {
  const storedWidth = Number(sessionStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
  return Number.isFinite(storedWidth) ? clampSidebarWidth(storedWidth) : DEFAULT_SIDEBAR_WIDTH;
}

function saveDashboardSession(dashboardSession) {
  if (!dashboardSession) {
    return;
  }
  const serializedDashboardSession = JSON.stringify(dashboardSession);
  sessionStorage.setItem(DASHBOARD_SESSION_STORAGE_KEY, serializedDashboardSession);
  try {
    localStorage.setItem(DASHBOARD_SESSION_STORAGE_KEY, serializedDashboardSession);
  } catch (_) {
    // sessionStorage is enough when localStorage is unavailable.
  }
}

// Page controller for the Vite Dashboard migration.
//
// This file owns state and side effects. Presentation components under
// components/dashboard/ receive plain values and callback functions, which
// keeps migrated React modules easier to explain in an interview.
export function DashboardPage() {
  const historyReportRunIdentifier = useMemo(getHistoryReportRunIdentifierFromUrl, []);
  const [dashboardSession, setDashboardSession] = useState(null);
  const [loadingIsActive, setLoadingIsActive] = useState(Boolean(historyReportRunIdentifier));
  const [loadingError, setLoadingError] = useState("");
  const [activeProfileIndex, setActiveProfileIndex] = useState(0);
  const [selectedIssueIdentifier, setSelectedIssueIdentifier] = useState("");
  const [selectedDimensionName, setSelectedDimensionName] = useState("");
  const [workspaceMode, setWorkspaceMode] = useState("preview");
  const [sidebarIsCollapsed, setSidebarIsCollapsed] = useState(
    () => sessionStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true",
  );
  const [sidebarWidth, setSidebarWidth] = useState(loadStoredSidebarWidth);
  const [assistantIsOpen, setAssistantIsOpen] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState([INITIAL_ASSISTANT_MESSAGE]);
  const [assistantIsPending, setAssistantIsPending] = useState(false);
  const [renderedAnalysisKey, setRenderedAnalysisKey] = useState("");

  const currentAnalysisPayload = dashboardSession?.current?.payload || null;
  const analysisResult = currentAnalysisPayload ? buildAnalysisView(currentAnalysisPayload) : null;
  const profileScoreItems = analysisResult?.profile_scores || [];
  const activeProfileLabel = getActiveProfileLabel(profileScoreItems, activeProfileIndex);
  const activeProfileDimensionEntries = useMemo(
    () => getActiveProfileDimensionEntries(analysisResult, activeProfileLabel),
    [analysisResult, activeProfileLabel],
  );
  const selectedIssueRecord = findIssueRecordByIdentifier(
    analysisResult,
    selectedIssueIdentifier,
    activeProfileLabel,
  );
  const currentSourceName = dashboardSession?.current?.sourceName
    || dashboardSession?.sourceName
    || currentAnalysisPayload?.run?.source_name
    || "Uploaded file";

  useEffect(() => {
    document.body.classList.add("dashboard-body");
    document.body.classList.remove("upload-body", "loading-body", "gaze-preview-hidden");
    return () => {
      document.body.classList.remove("dashboard-body");
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", `${sidebarWidth}px`);
    sessionStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    document.body.classList.toggle("sidebar-collapsed", sidebarIsCollapsed);
    sessionStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(sidebarIsCollapsed));
  }, [sidebarIsCollapsed]);

  useEffect(() => {
    if (!historyReportRunIdentifier) {
      const savedDashboardSession = normalizeDashboardSession(loadCurrentDashboardSession());
      setDashboardSession(savedDashboardSession);
      setLoadingIsActive(false);
      return undefined;
    }

    const dashboardReportRequestController = new AbortController();
    setLoadingIsActive(true);
    setLoadingError("");

    fetchDashboardReportDetail({
      historyReportRunIdentifier,
      abortSignal: dashboardReportRequestController.signal,
    })
      .then((dashboardReportDetail) => {
        setDashboardSession(buildDashboardSessionFromReportDetail(dashboardReportDetail));
        setLoadingIsActive(false);
      })
      .catch((error) => {
        if (error.name === "AbortError") {
          return;
        }
        setDashboardSession(null);
        setLoadingError(error.message || String(error));
        setLoadingIsActive(false);
      });

    return () => dashboardReportRequestController.abort();
  }, [historyReportRunIdentifier]);

  useEffect(() => {
    if (selectedIssueIdentifier && !selectedIssueRecord) {
      setSelectedIssueIdentifier("");
      if (workspaceMode === "detail") {
        setWorkspaceMode("summary");
      }
    }
  }, [selectedIssueIdentifier, selectedIssueRecord, workspaceMode]);

  const openIssueGuidance = useCallback((issueIdentifier) => {
    setSelectedDimensionName("");
    setSelectedIssueIdentifier((currentIssueIdentifier) => (
      currentIssueIdentifier === issueIdentifier && workspaceMode === "detail" ? "" : issueIdentifier
    ));
    setWorkspaceMode((currentWorkspaceMode) => (
      selectedIssueIdentifier === issueIdentifier && currentWorkspaceMode === "detail" ? "summary" : "detail"
    ));
  }, [selectedIssueIdentifier, workspaceMode]);

  const openIssuePreview = useCallback((issueIdentifier) => {
    setSelectedDimensionName("");
    setSelectedIssueIdentifier((currentIssueIdentifier) => (
      currentIssueIdentifier === issueIdentifier && workspaceMode === "preview" ? "" : issueIdentifier
    ));
    setWorkspaceMode((currentWorkspaceMode) => (
      selectedIssueIdentifier === issueIdentifier && currentWorkspaceMode === "preview" ? "summary" : "preview"
    ));
  }, [selectedIssueIdentifier, workspaceMode]);

  const openDimensionPreview = useCallback((dimensionName) => {
    setSelectedIssueIdentifier("");
    setSelectedDimensionName((currentDimensionName) => (
      currentDimensionName === dimensionName && workspaceMode === "preview" ? "" : dimensionName
    ));
    setWorkspaceMode((currentWorkspaceMode) => (
      selectedDimensionName === dimensionName && currentWorkspaceMode === "preview" ? "summary" : "preview"
    ));
  }, [selectedDimensionName, workspaceMode]);

  const startSidebarResize = useCallback((event) => {
    event.preventDefault();
    document.body.classList.add("resizing-sidebar");
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const resizeSidebar = (moveEvent) => {
      setSidebarWidth(clampSidebarWidth(moveEvent.clientX));
    };
    const stopSidebarResize = () => {
      document.body.classList.remove("resizing-sidebar");
      window.removeEventListener("pointermove", resizeSidebar);
      window.removeEventListener("pointerup", stopSidebarResize);
      window.removeEventListener("pointercancel", stopSidebarResize);
    };

    window.addEventListener("pointermove", resizeSidebar);
    window.addEventListener("pointerup", stopSidebarResize);
    window.addEventListener("pointercancel", stopSidebarResize);
  }, []);

  const updateSessionWithRenderedAnalysis = useCallback((renderedPayload, renderedHtml) => {
    setDashboardSession((currentDashboardSession) => {
      if (!currentDashboardSession?.current?.payload) {
        return currentDashboardSession;
      }
      const mergedPayload = {
        ...currentDashboardSession.current.payload,
        ...renderedPayload,
        run: currentDashboardSession.current.payload.run || renderedPayload.run,
        resource_bundle: currentDashboardSession.current.payload.resource_bundle || renderedPayload.resource_bundle,
        html_content: renderedHtml,
      };
      const nextDashboardSession = {
        ...currentDashboardSession,
        current: {
          ...currentDashboardSession.current,
          payload: mergedPayload,
          html: renderedHtml,
          savedAt: new Date().toISOString(),
        },
        html: renderedHtml,
        savedAt: new Date().toISOString(),
      };
      saveDashboardSession(nextDashboardSession);
      return nextDashboardSession;
    });
  }, []);

  const handleRenderedPreviewAvailable = useCallback((renderedHtml) => {
    if (!dashboardSession?.current?.sourceUrl || !renderedHtml.trim()) {
      return;
    }
    const nextRenderedAnalysisKey = `${dashboardSession.current.sourceUrl}:${renderedHtml.length}:${renderedHtml.slice(0, 300)}`;
    if (nextRenderedAnalysisKey === renderedAnalysisKey) {
      return;
    }
    setRenderedAnalysisKey(nextRenderedAnalysisKey);

    analyzeRenderedDashboardHtml({
      htmlContent: renderedHtml,
      sourceName: dashboardSession.current.sourceUrl || currentSourceName,
    })
      .then((renderedPayload) => updateSessionWithRenderedAnalysis(renderedPayload, renderedHtml))
      .catch(() => {
        // The preview can still be highlighted if live DOM re-analysis fails.
      });
  }, [currentSourceName, dashboardSession, renderedAnalysisKey, updateSessionWithRenderedAnalysis]);

  const printCurrentReport = useCallback(() => {
    const previousWorkspaceMode = workspaceMode;
    if (workspaceMode !== "summary" && workspaceMode !== "detail") {
      setWorkspaceMode("summary");
    }

    const restoreWorkspaceAfterPrint = () => {
      setWorkspaceMode(previousWorkspaceMode);
      window.removeEventListener("afterprint", restoreWorkspaceAfterPrint);
    };
    window.addEventListener("afterprint", restoreWorkspaceAfterPrint);
    window.setTimeout(() => window.print(), 0);
  }, [workspaceMode]);

  const submitAssistantMessage = useCallback((message) => {
    setAssistantMessages((currentMessages) => [...currentMessages, { role: "user", content: message }]);
    setAssistantIsPending(true);

    chatWithDashboardAssistant({
      message,
      analysisContext: buildAssistantContext(analysisResult, currentSourceName),
      sourceName: currentSourceName,
    })
      .then((assistantResponse) => {
        setAssistantMessages((currentMessages) => [
          ...currentMessages,
          {
            role: "assistant",
            content: assistantResponse.reply || "No assistant response was returned.",
          },
        ]);
      })
      .catch((error) => {
        setAssistantMessages((currentMessages) => [
          ...currentMessages,
          {
            role: "assistant",
            content: `I could not reach the AI assistant right now. ${error.message || String(error)}`,
          },
        ]);
      })
      .finally(() => setAssistantIsPending(false));
  }, [analysisResult, currentSourceName]);

  return (
    <>
      <AppNav activePage="dashboard" />
      <main className="tool-shell">
        <DashboardSidebar
          analysisResult={analysisResult}
          activeProfileIndex={activeProfileIndex}
          activeProfileLabel={activeProfileLabel}
          activeProfileDimensionEntries={activeProfileDimensionEntries}
          selectedIssueIdentifier={selectedIssueIdentifier}
          selectedDimensionName={selectedDimensionName}
          workspaceMode={workspaceMode}
          sidebarIsCollapsed={sidebarIsCollapsed}
          onActiveProfileIndexChange={setActiveProfileIndex}
          onDimensionPreviewOpen={openDimensionPreview}
          onIssueGuidanceOpen={openIssueGuidance}
          onIssuePreviewOpen={openIssuePreview}
          onSidebarToggle={() => setSidebarIsCollapsed((currentValue) => !currentValue)}
          onSidebarResizeStart={startSidebarResize}
        />
        <DashboardWorkspace
          dashboardSession={dashboardSession}
          analysisResult={analysisResult}
          activeProfileLabel={activeProfileLabel}
          activeProfileDimensionEntries={activeProfileDimensionEntries}
          selectedIssueRecord={selectedIssueRecord}
          selectedDimensionName={selectedDimensionName}
          workspaceMode={workspaceMode}
          loadingError={loadingError}
          loadingIsActive={loadingIsActive}
          showBackToHistoryButton={Boolean(historyReportRunIdentifier)}
          onPrintReport={printCurrentReport}
          onRenderedPreviewAvailable={handleRenderedPreviewAvailable}
        />
      </main>
      <AssistantFloatingPanel
        assistantIsOpen={assistantIsOpen}
        assistantMessages={assistantMessages}
        assistantIsPending={assistantIsPending}
        onAssistantOpen={() => setAssistantIsOpen(true)}
        onAssistantClose={() => setAssistantIsOpen(false)}
        onAssistantClear={() => setAssistantMessages([INITIAL_ASSISTANT_MESSAGE])}
        onAssistantSubmit={submitAssistantMessage}
      />
    </>
  );
}
