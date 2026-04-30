// API boundary for the Vite History page.
//
// HistoryPage.jsx calls the functions in this file when it needs backend data.
// Components such as ReportHistoryPanel.jsx and EyeHistoryPanel.jsx do not call
// fetch directly; they only render the data that HistoryPage has already loaded.
// Keeping all FastAPI requests here makes the UI components easier to read and
// makes endpoint changes easier to manage in one place.
const BACKEND_API_BASE_URL = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8001";

async function fetchJsonResponse(requestUrl, requestOptions = {}) {
  // Shared fetch wrapper used by every API function below. It converts backend
  // error responses into JavaScript Error objects so HistoryPage.jsx can show
  // the message through its loading/error state.
  const response = await fetch(requestUrl, requestOptions);
  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const responsePayload = await response.json();
      if (responsePayload?.detail) {
        errorMessage = responsePayload.detail;
      }
    } catch (error) {
      // Keep the fallback status message when the response body is not JSON.
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

// Build the paginated URL used by both data tables. HistoryPage.jsx passes the
// current page number and submitted search query here; the backend receives
// them as limit, offset, and query parameters.
export function buildPagedUrl(endpointPath, pageNumber, searchQuery, pageSize) {
  const searchParameters = new URLSearchParams({
    limit: String(pageSize),
    offset: String((Math.max(1, pageNumber) - 1) * pageSize),
  });

  if (searchQuery) {
    searchParameters.set("query", searchQuery);
  }

  return `${BACKEND_API_BASE_URL}${endpointPath}?${searchParameters.toString()}`;
}

export function fetchReportHistory({
  pageNumber,
  searchQuery,
  pageSize,
  abortSignal,
}) {
  // Called by HistoryPage.jsx to load the Report History table.
  // Backend interaction: GET /history?limit=...&offset=...&query=...
  return fetchJsonResponse(
    buildPagedUrl("/history", pageNumber, searchQuery, pageSize),
    { signal: abortSignal },
  );
}

export function fetchEyeHistory({
  pageNumber,
  searchQuery,
  pageSize,
  abortSignal,
}) {
  // Called by HistoryPage.jsx to load the Eye-Tracking Evidence table.
  // Backend interaction: GET /eye/sessions?limit=...&offset=...&query=...
  return fetchJsonResponse(
    buildPagedUrl("/eye/sessions", pageNumber, searchQuery, pageSize),
    { signal: abortSignal },
  );
}

export function fetchReportDetail(reportRunId) {
  // Called by HistoryPage.jsx when the user clicks View or Print in
  // ReportRows.jsx. The returned detail is converted by historyUtils.js into
  // the sessionStorage shape expected by the older dashboard.html page.
  return fetchJsonResponse(`${BACKEND_API_BASE_URL}/history/${reportRunId}`);
}
