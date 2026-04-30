import {
  analyzeHtmlText,
  analyzeUrl,
  analyzeUploadFile,
  analyzeVisualComplexityHtml,
  analyzeVisualComplexityUrl,
  loadDashboardSession,
  saveDashboardSession,
} from "./common.js?v=visual-complexity-score-1";

const PENDING_ANALYSIS_STORAGE_KEY = "cognilens.pending-analysis";
const MIN_LOADING_TIME_MS = 2600;
const ANALYSIS_RETURN_URL_STORAGE_KEY = "cognilens.return.analysis-url";
const DASHBOARD_HISTORY_CONTEXT_KEY = "cognilens.dashboard.history-context";
const DASHBOARD_HISTORY_ONCE_KEY = "cognilens.dashboard.history-once";

const loadingMessage = document.getElementById("analysisLoadingMessage");
const loadingPercent = document.getElementById("analysisLoadingPercent");
const loadingProgressBar = document.getElementById("analysisLoadingProgressBar");
const loadingError = document.getElementById("analysisLoadingError");

let displayedProgress = 8;

function initBackToAnalysisButton() {
  const backButton = document.getElementById("backToAnalysisButton");
  if (!backButton) {
    return;
  }
  let returnUrl = "";
  try {
    returnUrl = sessionStorage.getItem(ANALYSIS_RETURN_URL_STORAGE_KEY) || "";
  } catch (_) {
    returnUrl = "";
  }
  if (!returnUrl) {
    return;
  }
  backButton.hidden = false;
  backButton.addEventListener("click", () => {
    window.location.href = returnUrl;
  });
}

function setMessage(message) {
  loadingMessage.textContent = "";
  loadingMessage.append(document.createTextNode(message));
  if (message) {
    const dots = document.createElement("span");
    dots.className = "analysis-loading-dots";
    dots.setAttribute("aria-hidden", "true");
    loadingMessage.append(dots);
  }
}

function setProgress(value) {
  displayedProgress = Math.max(displayedProgress, Math.min(100, Math.round(value)));
  loadingPercent.textContent = `${displayedProgress}%`;
  loadingProgressBar.style.width = `${displayedProgress}%`;
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function loadPendingAnalysis() {
  const raw = sessionStorage.getItem(PENDING_ANALYSIS_STORAGE_KEY);
  if (!raw) {
    throw new Error("No pending analysis was found. Start a new analysis first.");
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    sessionStorage.removeItem(PENDING_ANALYSIS_STORAGE_KEY);
    throw new Error("The pending analysis could not be read. Start a new analysis again.");
  }
}

async function fileFromDataUrl(dataUrl, fileName, fileType) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: fileType || blob.type || "application/octet-stream" });
}

async function analyzePendingFile(pending) {
  if (pending.sourceType === "zip") {
    setProgress(24);
    setMessage("Reading the uploaded package");
    const file = await fileFromDataUrl(pending.fileDataUrl, pending.fileName, pending.fileType);
    setProgress(38);
    const payload = await analyzeUploadFile(file, pending.baselineRunId || null);
    return {
      payload,
      html: payload.html_content || "",
      sourceName: pending.fileName,
      sourceType: "zip",
    };
  }

  setProgress(28);
  setMessage("Reading the uploaded HTML");
  const html = pending.html || "";
  setProgress(42);
  const payload = await analyzeHtmlText(html, pending.fileName || "uploaded.html");
  return {
    payload,
    html,
    sourceName: pending.fileName || "uploaded.html",
    sourceType: "html",
  };
}

async function analyzePendingUrl(pending) {
  setProgress(24);
  setMessage("Fetching the live page");
  const payload = await analyzeUrl(pending.url, pending.baselineRunId || null);
  const html = payload.html_content || "";
  return {
    payload,
    html,
    sourceName: payload.resource_bundle?.entry_name || payload.run?.source_name || pending.url,
    sourceType: "url",
    sourceUrl: pending.url,
  };
}

async function attachVisualComplexity(result, pending) {
  setProgress(68);
  setMessage("Checking visual complexity");
  try {
    if (pending.mode === "url" && pending.url) {
      result.payload.visual_complexity = await analyzeVisualComplexityUrl(pending.url);
      return;
    }
    result.payload.visual_complexity = await analyzeVisualComplexityHtml(result.html || "");
  } catch (error) {
    result.payload.visual_complexity_error = error.message || String(error);
    if (pending.mode === "url" && result.html) {
      try {
        result.payload.visual_complexity = await analyzeVisualComplexityHtml(result.html);
      } catch (fallbackError) {
        result.payload.visual_complexity_error = fallbackError.message || String(fallbackError);
      }
    }
  }
}

function saveResult(result) {
  setProgress(92);
  sessionStorage.removeItem(DASHBOARD_HISTORY_CONTEXT_KEY);
  sessionStorage.removeItem(DASHBOARD_HISTORY_ONCE_KEY);
  const previousSession = loadDashboardSession();
  const savedAt = new Date().toISOString();
  saveDashboardSession({
    current: {
      payload: result.payload,
      html: result.html,
      sourceName: result.sourceName,
      sourceType: result.sourceType,
      sourceUrl: result.sourceUrl,
      savedAt,
    },
    previous: previousSession?.current || null,
    html: result.html,
    sourceName: result.sourceName,
    sourceUrl: result.sourceUrl,
    savedAt,
  });
}

function showError(error) {
  document.querySelector(".analysis-loading-page")?.setAttribute("aria-busy", "false");
  setMessage("");
  loadingError.textContent = error.message || String(error);
  loadingError.hidden = false;
}

async function runPendingAnalysis() {
  const startedAt = Date.now();
  try {
    const pending = loadPendingAnalysis();
    setProgress(12);
    const result = pending.mode === "url"
      ? await analyzePendingUrl(pending)
      : await analyzePendingFile(pending);

    await attachVisualComplexity(result, pending);
    setProgress(86);
    setMessage("Preparing the report");
    saveResult(result);
    sessionStorage.removeItem(PENDING_ANALYSIS_STORAGE_KEY);
    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_LOADING_TIME_MS) {
      await wait(MIN_LOADING_TIME_MS - elapsed);
    }
    setProgress(100);
    await wait(350);
    window.location.href = "./dashboard.html";
  } catch (error) {
    showError(error);
  }
}

initBackToAnalysisButton();
runPendingAnalysis();
