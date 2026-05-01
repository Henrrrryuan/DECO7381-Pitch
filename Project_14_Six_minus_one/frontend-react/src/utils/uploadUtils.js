export const DASHBOARD_SESSION_STORAGE_KEY = "cognilens-dashboard-session";
export const EYE_TARGET_WEBSITE_ADDRESS_STORAGE_KEY = "cognilens.eye.target-url";
export const PENDING_ANALYSIS_STORAGE_KEY = "cognilens.pending-analysis";
export const LEGACY_LOADING_PAGE_ADDRESS = "http://127.0.0.1:8001/loading.html";

// Utility functions shared by the Vite Home page and its upload workflow.
//
// HomePage.jsx calls these helpers through api/uploadApi.js when the user starts
// a URL analysis, file upload analysis, or sample analysis. The old
// frontend/loading.js file then reads the saved pending-analysis payload from
// sessionStorage and continues the existing backend analysis flow.

export function isHtmlFile(selectedFile) {
  return Boolean(selectedFile?.name?.toLowerCase().match(/\.html?$/));
}

export function isZipFile(selectedFile) {
  return Boolean(selectedFile?.name?.toLowerCase().endsWith(".zip"));
}

export function isSupportedUploadFile(selectedFile) {
  return isHtmlFile(selectedFile) || isZipFile(selectedFile);
}

export function normalizeWebsiteAddress(rawWebsiteAddress) {
  const trimmedWebsiteAddress = String(rawWebsiteAddress || "").trim();
  if (!trimmedWebsiteAddress) {
    throw new Error("Enter a URL or local development server address first.");
  }

  const hasHttpProtocol = /^https?:\/\//i.test(trimmedWebsiteAddress);
  const hasUnsupportedProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmedWebsiteAddress) && !hasHttpProtocol;
  if (hasUnsupportedProtocol) {
    throw new Error("Only http:// or https:// URLs are supported.");
  }

  const candidateWebsiteAddress = hasHttpProtocol
    ? trimmedWebsiteAddress
    : `http://${trimmedWebsiteAddress}`;

  let candidateHostName = "";
  try {
    candidateHostName = new URL(candidateWebsiteAddress).hostname.toLowerCase();
  } catch (_) {
    throw new Error("Enter a valid URL, for example http://localhost:5173.");
  }

  const candidateIsLocalTarget = isLocalWebsiteHost(candidateHostName);
  const websiteAddressWithProtocol = hasHttpProtocol
    ? trimmedWebsiteAddress
    : `${candidateIsLocalTarget ? "http" : "https"}://${trimmedWebsiteAddress}`;

  let parsedWebsiteAddress;
  try {
    parsedWebsiteAddress = new URL(websiteAddressWithProtocol);
  } catch (_) {
    throw new Error("Enter a valid URL, for example http://localhost:5173.");
  }

  if (parsedWebsiteAddress.protocol !== "http:" && parsedWebsiteAddress.protocol !== "https:") {
    throw new Error("Only http:// or https:// URLs are supported.");
  }

  if (!isLocalWebsiteHost(parsedWebsiteAddress.hostname.toLowerCase())) {
    throw new Error("Only local URLs are supported (localhost, 127.0.0.1, or LAN IP).");
  }

  return parsedWebsiteAddress.href;
}

export function isLocalWebsiteHost(hostName) {
  return (
    hostName === "localhost" ||
    hostName === "0.0.0.0" ||
    hostName === "::1" ||
    hostName.endsWith(".local") ||
    /^127\./.test(hostName) ||
    /^10\./.test(hostName) ||
    /^192\.168\./.test(hostName) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostName)
  );
}

export function readSelectedFileAsDataAddress(selectedFile) {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.addEventListener("load", () => resolve(String(fileReader.result || "")));
    fileReader.addEventListener(
      "error",
      () => reject(fileReader.error || new Error("Could not read the selected file.")),
    );
    fileReader.readAsDataURL(selectedFile);
  });
}

export function loadCurrentDashboardSession() {
  let serializedDashboardSession = sessionStorage.getItem(DASHBOARD_SESSION_STORAGE_KEY);
  if (!serializedDashboardSession) {
    try {
      serializedDashboardSession = localStorage.getItem(DASHBOARD_SESSION_STORAGE_KEY);
    } catch (_) {
      serializedDashboardSession = "";
    }
  }

  if (!serializedDashboardSession) {
    return null;
  }

  try {
    return JSON.parse(serializedDashboardSession);
  } catch (_) {
    return null;
  }
}

export function getCurrentBaselineRunIdentifier() {
  const currentDashboardSession = loadCurrentDashboardSession();
  return currentDashboardSession?.current?.payload?.run?.run_id || null;
}

export function savePendingAnalysisPayload(pendingAnalysisPayload) {
  sessionStorage.setItem(PENDING_ANALYSIS_STORAGE_KEY, JSON.stringify(pendingAnalysisPayload));
}

export function persistEyeTrackingTargetAddress(websiteAddress) {
  try {
    const storageValue = String(websiteAddress || "").trim();
    if (storageValue) {
      localStorage.setItem(EYE_TARGET_WEBSITE_ADDRESS_STORAGE_KEY, storageValue);
    } else {
      localStorage.removeItem(EYE_TARGET_WEBSITE_ADDRESS_STORAGE_KEY);
    }
  } catch (_) {
    // The Home page can still start analysis when localStorage is unavailable.
  }
}
