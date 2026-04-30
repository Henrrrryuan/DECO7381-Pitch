import {
  isHtmlFile,
  isZipFile,
  loadDashboardSession,
} from "./common.js?v=visual-complexity-score-1";

const state = {
  file: null,
  url: "",
  workflow: "url",
  loading: false,
};
const EYE_TARGET_URL_STORAGE_KEY = "cognilens.eye.target-url";
const PENDING_ANALYSIS_STORAGE_KEY = "cognilens.pending-analysis";
const ANALYSIS_RETURN_URL_STORAGE_KEY = "cognilens.return.analysis-url";

const workflowOptions = Array.from(document.querySelectorAll("[data-workflow-option]"));
const workflowPanels = Array.from(document.querySelectorAll("[data-workflow-panel]"));
const urlInput = document.getElementById("urlInput");
const urlForm = document.getElementById("urlForm");
const analyzeUrlButton = document.getElementById("analyzeUrlButton");
const uploadInput = document.getElementById("uploadInput");
const uploadForm = document.getElementById("uploadForm");
const dropzone = document.getElementById("dropzone");
const selectedFileName = document.getElementById("selectedFileName");
const analyzeButton = document.getElementById("analyzeButton");
const uploadStatus = document.getElementById("uploadStatus");
const EYE_TRACKING_BASE_URL = "http://127.0.0.1:8001/eye/";
const eyeTrackingLinks = Array.from(
  document.querySelectorAll('a[href="/eye/"], a[href="http://127.0.0.1:8001/eye/"]'),
);

function setStatus(message, isError = false) {
  uploadStatus.textContent = message;
  uploadStatus.classList.toggle("error", isError);
}

function updateEyeTrackingLinks(rawValue) {
  const trimmed = String(rawValue || "").trim();
  const targetHref = trimmed
    ? `${EYE_TRACKING_BASE_URL}?prefill_url=${encodeURIComponent(trimmed)}`
    : EYE_TRACKING_BASE_URL;
  eyeTrackingLinks.forEach((link) => {
    link.href = targetHref;
  });
}

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

function setWorkflow(workflow) {
  state.workflow = workflow === "file" ? "file" : "url";

  workflowOptions.forEach((option) => {
    const isActive = option.dataset.workflowOption === state.workflow;
    option.classList.toggle("is-active", isActive);
    option.setAttribute("aria-selected", String(isActive));
  });

  workflowPanels.forEach((panel) => {
    const isActive = panel.dataset.workflowPanel === state.workflow;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });

  if (!state.loading) {
    if (state.workflow === "url") {
      syncUrl(urlInput.value);
      setStatus("");
      urlInput.focus();
    } else {
      syncFile(state.file);
      setStatus(state.file ? `${state.file.name} is ready for analysis.` : "");
    }
  }
}

function syncFile(file) {
  state.file = file || null;
  selectedFileName.textContent = file ? file.name : "or choose an HTML / ZIP file";
  analyzeButton.disabled = !file || state.loading;
  if (file) {
    setStatus(`${file.name} is ready for analysis.`);
  } else {
    setStatus("");
  }
}

function syncUrl(value) {
  state.url = (value || "").trim();
  analyzeUrlButton.disabled = !state.url || state.loading;
  updateEyeTrackingLinks(state.url);
  try {
    if (state.url) {
      localStorage.setItem(EYE_TARGET_URL_STORAGE_KEY, state.url);
    } else {
      localStorage.removeItem(EYE_TARGET_URL_STORAGE_KEY);
    }
  } catch (_) {
    // Ignore localStorage failures and keep the current in-memory URL.
  }
}

function setLoading(loading) {
  state.loading = loading;
  analyzeButton.disabled = loading || !state.file;
  analyzeUrlButton.disabled = loading || !state.url;
  analyzeButton.textContent = loading ? "Analyzing..." : "Analyze";
  analyzeUrlButton.textContent = loading ? "Analyzing..." : "Analyze";
}

function normalizeUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) {
    throw new Error("Enter a URL or local dev server address first.");
  }

  const hasHttpProtocol = /^https?:\/\//i.test(value);
  const hasOtherProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value);
  if (hasOtherProtocol && !hasHttpProtocol) {
    throw new Error("Only http:// or https:// URLs are supported.");
  }

  const candidateForHost = hasHttpProtocol ? value : `http://${value}`;
  let host = "";
  try {
    host = new URL(candidateForHost).hostname.toLowerCase();
  } catch (error) {
    throw new Error("Enter a valid URL, for example http://localhost:5173.");
  }

  const isLocalTarget =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  const withProtocol = hasHttpProtocol
    ? value
    : `${isLocalTarget ? "http" : "https"}://${value}`;

  let parsed;
  try {
    parsed = new URL(withProtocol);
  } catch (error) {
    throw new Error("Enter a valid URL, for example http://localhost:5173.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http:// or https:// URLs are supported.");
  }

  return parsed.href;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error || new Error("Could not read the selected file.")));
    reader.readAsDataURL(file);
  });
}

function savePendingAnalysis(payload) {
  sessionStorage.setItem(PENDING_ANALYSIS_STORAGE_KEY, JSON.stringify(payload));
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!state.file || state.loading) {
    return;
  }

  setLoading(true);
  setStatus("Preparing the analysis page...");

  try {
    const previousSession = loadDashboardSession();
    const baselineRunId = previousSession?.current?.payload?.run?.run_id || null;
    const pendingPayload = {
      mode: "file",
      fileName: state.file.name,
      fileType: state.file.type || "",
      sourceType: isZipFile(state.file) ? "zip" : "html",
      baselineRunId,
      createdAt: new Date().toISOString(),
    };

    if (isZipFile(state.file)) {
      pendingPayload.fileDataUrl = await readFileAsDataUrl(state.file);
    } else {
      pendingPayload.html = await state.file.text();
    }

    savePendingAnalysis(pendingPayload);
    window.location.href = "./loading.html";
  } catch (error) {
    setStatus(error.message, true);
    setLoading(false);
  }
}

async function handleUrlSubmit(event) {
  event.preventDefault();
  if (state.loading) {
    return;
  }

  let normalizedUrl;
  try {
    normalizedUrl = normalizeUrl(state.url);
  } catch (error) {
    setStatus(error.message, true);
    return;
  }

  setLoading(true);
  setStatus("Opening the analysis progress page...");

  try {
    const previousSession = loadDashboardSession();
    const baselineRunId = previousSession?.current?.payload?.run?.run_id || null;
    try {
      localStorage.setItem(EYE_TARGET_URL_STORAGE_KEY, normalizedUrl);
    } catch (_) {
      // Ignore localStorage failures and continue saving the dashboard session.
    }
    savePendingAnalysis({
      mode: "url",
      url: normalizedUrl,
      baselineRunId,
      createdAt: new Date().toISOString(),
    });
    window.location.href = "./loading.html";
  } catch (error) {
    setStatus(error.message, true);
    setLoading(false);
  }
}

function bindDropzone() {
  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("dragging");
    });
  });

  ["dragleave", "dragend", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("dragging");
    });
  });

  dropzone.addEventListener("drop", (event) => {
    const [file] = event.dataTransfer?.files || [];
    if (!file) {
      return;
    }
    if (!isHtmlFile(file) && !isZipFile(file)) {
      setStatus("Only HTML and ZIP files are supported on the upload page.", true);
      return;
    }
    uploadInput.files = event.dataTransfer.files;
    syncFile(file);
  });
}

uploadInput.addEventListener("change", (event) => {
  const [file] = event.target.files || [];
  if (!file) {
    syncFile(null);
    return;
  }
  if (!isHtmlFile(file) && !isZipFile(file)) {
    event.target.value = "";
    syncFile(null);
    setStatus("Only HTML and ZIP files are supported on the upload page.", true);
    return;
  }
  syncFile(file);
});

urlInput.addEventListener("input", (event) => {
  syncUrl(event.target.value);
});

workflowOptions.forEach((option) => {
  option.addEventListener("click", () => {
    setWorkflow(option.dataset.workflowOption);
  });
});

urlForm.addEventListener("submit", handleUrlSubmit);
uploadForm.addEventListener("submit", handleSubmit);
window.addEventListener("pageshow", () => {
  state.loading = false;
  setLoading(false);
});
bindDropzone();
initBackToAnalysisButton();
try {
  const storedEyeTargetUrl = localStorage.getItem(EYE_TARGET_URL_STORAGE_KEY) || "";
  if (storedEyeTargetUrl && !urlInput.value.trim()) {
    urlInput.value = storedEyeTargetUrl;
  }
} catch (_) {
  // Ignore localStorage failures and fall back to the empty input state.
}
syncUrl(urlInput.value);
setWorkflow("url");
