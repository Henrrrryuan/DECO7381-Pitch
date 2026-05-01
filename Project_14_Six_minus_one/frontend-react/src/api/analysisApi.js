// API boundary for the Vite Loading page.
//
// LoadingPage.jsx calls these functions after it reads the pending-analysis
// payload created by HomePage.jsx. This file mirrors the old frontend/common.js
// backend requests, but keeps the network code in one React-friendly module.
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
    } catch (_) {
      // Keep the fallback status text when the response body is not JSON.
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

export function analyzeHtmlText({
  htmlContent,
  sourceName,
  baselineRunIdentifier,
}) {
  // Backend interaction: POST /analyze for uploaded or pasted HTML.
  return fetchJsonResponse(`${BACKEND_API_BASE_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html: htmlContent,
      source_name: sourceName,
      baseline_run_id: baselineRunIdentifier || null,
      persist_result: true,
    }),
  });
}

export function analyzeWebsiteAddress({
  websiteAddress,
  baselineRunIdentifier,
}) {
  // Backend interaction: POST /analyze-url for localhost or LAN pages.
  return fetchJsonResponse(`${BACKEND_API_BASE_URL}/analyze-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: websiteAddress,
      source_name: websiteAddress,
      baseline_run_id: baselineRunIdentifier || null,
    }),
  });
}

export function analyzeZipFile({
  selectedZipFile,
  baselineRunIdentifier,
}) {
  // Backend interaction: POST /analyze-zip for ZIP packages.
  const formData = new FormData();
  formData.append("file", selectedZipFile);
  if (baselineRunIdentifier) {
    formData.append("baseline_run_id", baselineRunIdentifier);
  }
  return fetchJsonResponse(`${BACKEND_API_BASE_URL}/analyze-zip`, {
    method: "POST",
    body: formData,
  });
}

export function analyzeVisualComplexityHtml(htmlContent) {
  // Backend interaction: POST /visual-complexity for uploaded HTML fallback.
  return fetchJsonResponse(`${BACKEND_API_BASE_URL}/visual-complexity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html: htmlContent }),
  });
}

export function analyzeVisualComplexityWebsiteAddress(websiteAddress) {
  // Backend interaction: POST /visual-complexity-url for live local pages.
  return fetchJsonResponse(`${BACKEND_API_BASE_URL}/visual-complexity-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: websiteAddress }),
  });
}
