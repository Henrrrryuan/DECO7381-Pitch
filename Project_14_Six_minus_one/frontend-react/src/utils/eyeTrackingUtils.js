export const EYE_TARGET_URL_STORAGE_KEY = "cognilens.eye.target-url";
export const ANALYSIS_RETURN_URL_STORAGE_KEY = "cognilens.return.analysis-url";

export function getErrorMessage(error) {
  if (!error) {
    return "Unknown error";
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  try {
    return JSON.stringify(error);
  } catch (_) {
    return String(error);
  }
}

export function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function distanceBetweenPoints(firstPoint, secondPoint) {
  const deltaX = firstPoint.x - secondPoint.x;
  const deltaY = firstPoint.y - secondPoint.y;
  return Math.hypot(deltaX, deltaY);
}

export function normalizeTargetUrl(rawInput) {
  const inputValue = String(rawInput || "").trim();
  if (!inputValue) {
    throw new Error("Please input a URL first.");
  }

  const hasHttpProtocol = /^https?:\/\//i.test(inputValue);
  const hasOtherProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(inputValue);
  if (hasOtherProtocol && !hasHttpProtocol) {
    throw new Error("Only http:// or https:// URLs are supported.");
  }

  const candidateUrl = hasHttpProtocol ? inputValue : `http://${inputValue}`;
  let hostName = "";
  try {
    hostName = new URL(candidateUrl).hostname.toLowerCase();
  } catch (_) {
    throw new Error("Invalid URL format.");
  }

  const isLocalTarget =
    hostName === "localhost" ||
    hostName === "0.0.0.0" ||
    hostName === "::1" ||
    hostName.endsWith(".local") ||
    /^127\./.test(hostName) ||
    /^10\./.test(hostName) ||
    /^192\.168\./.test(hostName) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostName);
  const urlWithProtocol = hasHttpProtocol
    ? inputValue
    : `${isLocalTarget ? "http" : "https"}://${inputValue}`;

  let parsedUrl;
  try {
    parsedUrl = new URL(urlWithProtocol);
  } catch (_) {
    throw new Error("Invalid URL format.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("Only http:// or https:// URLs are supported.");
  }

  return parsedUrl.href;
}

export function readPreferredTargetUrl(searchParameters) {
  const explicitTarget = (searchParameters.get("prefill_url") || "").trim();
  if (explicitTarget) {
    return explicitTarget;
  }

  try {
    return (localStorage.getItem(EYE_TARGET_URL_STORAGE_KEY) || "").trim();
  } catch (_) {
    return "";
  }
}

export function persistPreferredTargetUrl(targetUrl) {
  try {
    const storageValue = String(targetUrl || "").trim();
    if (storageValue) {
      localStorage.setItem(EYE_TARGET_URL_STORAGE_KEY, storageValue);
    } else {
      localStorage.removeItem(EYE_TARGET_URL_STORAGE_KEY);
    }
  } catch (_) {
    // Ignore localStorage failures and keep the current in-memory target URL.
  }
}

export function formatDuration(durationMilliseconds) {
  const totalSeconds = Math.max(0, Math.round((Number(durationMilliseconds) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function loadGazeCloudApi() {
  // GazeCloudAPI is a third-party script, so the React page loads it only when
  // the user starts recording instead of blocking the initial page render.
  if (window.GazeCloudAPI) {
    return Promise.resolve(window.GazeCloudAPI);
  }

  const existingScript = document.getElementById("gazeCloudApiScript");
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener("load", () => resolve(window.GazeCloudAPI), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("GazeCloudAPI script did not load.")), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const scriptElement = document.createElement("script");
    scriptElement.id = "gazeCloudApiScript";
    scriptElement.src = "https://api.gazerecorder.com/GazeCloudAPI.js";
    scriptElement.async = true;
    scriptElement.onload = () => resolve(window.GazeCloudAPI);
    scriptElement.onerror = () => reject(new Error("GazeCloudAPI script did not load."));
    document.head.appendChild(scriptElement);
  });
}
