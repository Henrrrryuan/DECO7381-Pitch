// API boundary for the Vite Dashboard page.
//
// DashboardPage.jsx calls this file when it needs backend data.
//
// Keeping fetch logic here means Dashboard components only describe interface
// behavior. They do not need to know the backend route names used for history,
// assistant chat, or rendered DOM re-analysis.
const BACKEND_API_BASE_URL = import.meta.env.VITE_API_BASE ?? "";

async function fetchJsonResponse(requestUrl, requestOptions = {}) {
  const response = await fetch(requestUrl, requestOptions);
  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const responsePayload = await response.json();
      if (responsePayload?.detail) {
        errorMessage = responsePayload.detail;
      }
    } catch (_) {
      // Keep the fallback status message when the backend body is not JSON.
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

export function fetchDashboardReportDetail({
  historyReportRunIdentifier,
  abortSignal,
}) {
  // Backend interaction: GET /history/{run_id}
  return fetchJsonResponse(
    `${BACKEND_API_BASE_URL}/history/${encodeURIComponent(historyReportRunIdentifier)}`,
    { signal: abortSignal },
  );
}

export function chatWithDashboardAssistant({
  message,
  analysisContext,
  sourceName,
}) {
  // Backend interaction: POST /assistant/chat.
  return fetchJsonResponse(`${BACKEND_API_BASE_URL}/assistant/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      analysis_context: analysisContext,
      source_name: sourceName,
    }),
  });
}

export function analyzeRenderedDashboardHtml({
  htmlContent,
  sourceName,
}) {
  // Backend interaction: POST /analyze without saving a new history report.
  return fetchJsonResponse(`${BACKEND_API_BASE_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html: htmlContent,
      source_name: sourceName,
      persist_result: false,
    }),
  });
}
