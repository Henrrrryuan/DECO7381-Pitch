// API boundary for the Vite Eye Tracking page.
//
// EyeTrackingPage.jsx calls this file when it needs to load a target page
// through the FastAPI proxy or save an eye-tracking evidence session. The
// React components under components/eye/ do not call fetch directly; they only
// render the workflow state and trigger callbacks owned by EyeTrackingPage.jsx.
const EYE_API_BASE_URL = import.meta.env.VITE_EYE_API_BASE || "";

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
      // Keep the fallback status message when the backend response is not JSON.
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

export function buildEyeProxyUrl(targetUrl) {
  // Keep the iframe URL same-origin with the Vite page. In development,
  // vite.config.js proxies /eye/proxy to FastAPI on port 8001; in production,
  // the same relative path can be served by FastAPI directly.
  return `${EYE_API_BASE_URL}/eye/proxy?url=${encodeURIComponent(targetUrl)}`;
}

export function saveEyeTrackingSession(eyeSessionPayload) {
  // Called by EyeTrackingPage.jsx after the user records gaze samples and clicks
  // Save Session. Backend interaction: POST /eye/sessions.
  return fetchJsonResponse(`${EYE_API_BASE_URL}/eye/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eyeSessionPayload),
  });
}
