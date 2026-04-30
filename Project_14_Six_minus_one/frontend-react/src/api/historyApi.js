// This module is the only place where the Vite History page talks to the
// FastAPI backend. Components call these functions instead of building fetch
// requests directly, which keeps backend communication separate from UI code.
const BACKEND_API_BASE_URL = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8001";

async function fetchJsonResponse(requestUrl, requestOptions = {}) {
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

// Build the paginated URL used by both the report history table and the
// eye-tracking evidence table. The backend uses limit/offset pagination.
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
  return fetchJsonResponse(
    buildPagedUrl("/eye/sessions", pageNumber, searchQuery, pageSize),
    { signal: abortSignal },
  );
}

export function fetchReportDetail(reportRunId) {
  return fetchJsonResponse(`${BACKEND_API_BASE_URL}/history/${reportRunId}`);
}
