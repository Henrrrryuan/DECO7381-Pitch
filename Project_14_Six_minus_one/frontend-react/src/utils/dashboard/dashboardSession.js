import { DASHBOARD_HISTORY_CONTEXT_KEY } from "./constants.js";
import { isProbablyWebsiteAddress } from "./dashboardLabels.js";

// Dashboard session helpers.
//
// DashboardPage.jsx uses this module when it reads a Report ID from the URL,
// loads a saved report from the backend, or normalizes the sessionStorage shape
// produced by the Home and History pages.
export function getHistoryReportRunIdentifierFromUrl() {
  const searchParameters = new URLSearchParams(window.location.search);
  const explicitRunIdentifier = searchParameters.get("run") || "";
  if (searchParameters.get("from") === "history" && explicitRunIdentifier) {
    return explicitRunIdentifier;
  }

  try {
    return sessionStorage.getItem(DASHBOARD_HISTORY_CONTEXT_KEY) || "";
  } catch (_) {
    return "";
  }
}

export function buildDashboardSessionFromReportDetail(dashboardReportDetail) {
  const sourceName = dashboardReportDetail.run?.source_name || "history-item";
  const analysisPayload = dashboardReportDetail.analysis || dashboardReportDetail.result || {};
  return {
    current: {
      payload: {
        ...analysisPayload,
        run: dashboardReportDetail.run || analysisPayload?.run,
        resource_bundle: dashboardReportDetail.resource_bundle || analysisPayload?.resource_bundle || null,
        html_content: dashboardReportDetail.html_content || analysisPayload?.html_content || "",
      },
      html: dashboardReportDetail.html_content || analysisPayload?.html_content || "",
      sourceName,
      sourceUrl: isProbablyWebsiteAddress(sourceName) ? sourceName : "",
    },
    previous: null,
  };
}

export function normalizeDashboardSession(rawDashboardSession) {
  if (!rawDashboardSession?.current?.payload) {
    return null;
  }

  const currentPayload = rawDashboardSession.current.payload;
  const sourceName = rawDashboardSession.current.sourceName
    || rawDashboardSession.sourceName
    || currentPayload?.run?.source_name
    || "Uploaded file";
  return {
    current: {
      payload: currentPayload,
      html: rawDashboardSession.current.html || rawDashboardSession.html || currentPayload.html_content || "",
      sourceName,
      sourceType: rawDashboardSession.current.sourceType || "",
      sourceUrl: rawDashboardSession.current.sourceUrl || rawDashboardSession.sourceUrl || (isProbablyWebsiteAddress(sourceName) ? sourceName : ""),
      savedAt: rawDashboardSession.current.savedAt || rawDashboardSession.savedAt || "",
    },
    previous: rawDashboardSession.previous || null,
    html: rawDashboardSession.html || rawDashboardSession.current.html || "",
    sourceName,
    sourceUrl: rawDashboardSession.sourceUrl || rawDashboardSession.current.sourceUrl || "",
    savedAt: rawDashboardSession.savedAt || rawDashboardSession.current.savedAt || "",
  };
}

export function buildAnalysisView(analysisPayload) {
  return {
    overall_score: analysisPayload?.overall_score,
    weighted_average: analysisPayload?.weighted_average,
    min_dimension_score: analysisPayload?.min_dimension_score,
    dimensions: analysisPayload?.dimensions || [],
    profile_scores: analysisPayload?.profile_scores || [],
    visual_complexity: analysisPayload?.visual_complexity || null,
  };
}

export function formatReportTimestamp(value) {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }
  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");
  const hour = String(parsedDate.getHours()).padStart(2, "0");
  const minute = String(parsedDate.getMinutes()).padStart(2, "0");
  const second = String(parsedDate.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hour}${minute}${second}`;
}
