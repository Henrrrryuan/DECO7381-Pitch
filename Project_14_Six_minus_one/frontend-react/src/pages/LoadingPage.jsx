import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  analyzeHtmlText,
  analyzeUrl,
  analyzeUploadFile,
  analyzeVisualComplexityHtml,
  analyzeVisualComplexityUrl,
  loadDashboardSession,
  saveDashboardSession,
} from "../lib/common.js";
import { AccessibilityWidgetMount } from "../components/AccessibilityWidgetMount.jsx";

const PENDING_ANALYSIS_STORAGE_KEY = "cognilens.pending-analysis";
const MIN_LOADING_TIME_MS = 2600;
const DASHBOARD_HISTORY_CONTEXT_KEY = "cognilens.dashboard.history-context";
const DASHBOARD_HISTORY_ONCE_KEY = "cognilens.dashboard.history-once";

function createCancelledError() {
  const error = new Error("Analysis cancelled by user.");
  error.name = "AnalysisCancelledError";
  return error;
}

async function fileFromDataUrl(dataUrl, fileName, fileType) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: fileType || blob.type || "application/octet-stream" });
}

export function LoadingPage() {
  useEffect(() => {
    document.body.classList.add("upload-body", "loading-body");
    return () => document.body.classList.remove("upload-body", "loading-body");
  }, []);

  const navigate = useNavigate();
  const cancelRequestedRef = useRef(false);
  const displayedProgressRef = useRef(8);

  useEffect(() => {
    const loadingMessage = document.getElementById("analysisLoadingMessage");
    const loadingPercent = document.getElementById("analysisLoadingPercent");
    const loadingProgressBar = document.getElementById("analysisLoadingProgressBar");
    const loadingError = document.getElementById("analysisLoadingError");
    const cancelButton = document.getElementById("analysisCancelButton");

    function ensureNotCancelled() {
      if (cancelRequestedRef.current) {
        throw createCancelledError();
      }
    }

    function setMessage(message) {
      if (!loadingMessage) {
        return;
      }
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
      displayedProgressRef.current = Math.max(
        displayedProgressRef.current,
        Math.min(100, Math.round(value)),
      );
      if (loadingPercent) {
        loadingPercent.textContent = `${displayedProgressRef.current}%`;
      }
      if (loadingProgressBar) {
        loadingProgressBar.style.width = `${displayedProgressRef.current}%`;
      }
    }

    function wait(ms) {
      return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
      });
    }

    function loadPendingAnalysis() {
      const raw = sessionStorage.getItem(PENDING_ANALYSIS_STORAGE_KEY);
      if (!raw) {
        throw new Error("No pending analysis was found. Start a new analysis first.");
      }
      try {
        return JSON.parse(raw);
      } catch {
        sessionStorage.removeItem(PENDING_ANALYSIS_STORAGE_KEY);
        throw new Error("The pending analysis could not be read. Start a new analysis again.");
      }
    }

    async function analyzePendingFile(pending) {
      ensureNotCancelled();
      if (pending.sourceType === "zip") {
        setProgress(24);
        setMessage("Reading the uploaded package");
        const file = await fileFromDataUrl(pending.fileDataUrl, pending.fileName, pending.fileType);
        ensureNotCancelled();
        setProgress(38);
        const payload = await analyzeUploadFile(file, pending.baselineRunId || null);
        ensureNotCancelled();
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
      ensureNotCancelled();
      return {
        payload,
        html,
        sourceName: pending.fileName || "uploaded.html",
        sourceType: "html",
      };
    }

    async function analyzePendingUrl(pending) {
      ensureNotCancelled();
      setProgress(24);
      setMessage("Fetching the live page");
      const payload = await analyzeUrl(pending.url, pending.baselineRunId || null);
      ensureNotCancelled();
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
      ensureNotCancelled();
      setProgress(68);
      setMessage("Checking visual complexity");
      try {
        if (pending.mode === "url" && pending.url) {
          result.payload.visual_complexity = await analyzeVisualComplexityUrl(pending.url);
          ensureNotCancelled();
          return;
        }
        result.payload.visual_complexity = await analyzeVisualComplexityHtml(result.html || "");
        ensureNotCancelled();
      } catch (error) {
        ensureNotCancelled();
        result.payload.visual_complexity_error = error.message || String(error);
        if (pending.mode === "url" && result.html) {
          try {
            result.payload.visual_complexity = await analyzeVisualComplexityHtml(result.html);
            ensureNotCancelled();
          } catch (fallbackError) {
            result.payload.visual_complexity_error = fallbackError.message || String(fallbackError);
          }
        }
      }
    }

    function saveResult(result) {
      ensureNotCancelled();
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
      if (loadingError) {
        loadingError.textContent = error.message || String(error);
        loadingError.hidden = false;
      }
    }

    async function runPendingAnalysis() {
      const startedAt = Date.now();
      try {
        ensureNotCancelled();
        const pending = loadPendingAnalysis();
        setProgress(12);
        const result =
          pending.mode === "url" ? await analyzePendingUrl(pending) : await analyzePendingFile(pending);

        ensureNotCancelled();
        await attachVisualComplexity(result, pending);
        ensureNotCancelled();
        setProgress(86);
        setMessage("Preparing the report");
        saveResult(result);
        ensureNotCancelled();
        sessionStorage.removeItem(PENDING_ANALYSIS_STORAGE_KEY);
        const elapsed = Date.now() - startedAt;
        if (elapsed < MIN_LOADING_TIME_MS) {
          await wait(MIN_LOADING_TIME_MS - elapsed);
        }
        ensureNotCancelled();
        setProgress(100);
        await wait(350);
        ensureNotCancelled();
        navigate("/dashboard");
      } catch (error) {
        if (cancelRequestedRef.current || error?.name === "AnalysisCancelledError") {
          return;
        }
        showError(error);
      }
    }

    const onCancel = () => {
      if (cancelRequestedRef.current) {
        return;
      }
      cancelRequestedRef.current = true;
      sessionStorage.removeItem(PENDING_ANALYSIS_STORAGE_KEY);
      if (loadingError) {
        loadingError.hidden = true;
      }
      setMessage("Cancelling and returning to home");
      if (cancelButton) {
        cancelButton.disabled = true;
        cancelButton.textContent = "Cancelling...";
      }
      navigate("/");
    };

    cancelButton?.addEventListener("click", onCancel);
    runPendingAnalysis();

    return () => {
      cancelButton?.removeEventListener("click", onCancel);
    };
  }, [navigate]);

  return (
    <>
      <AccessibilityWidgetMount />
      <header className="app-nav">
        <div className="app-nav-inner">
          <Link className="app-brand" to="/">
            <span className="app-brand-mark">C</span>
            <span className="app-brand-name">CogniLens</span>
          </Link>

          <nav className="app-nav-links" aria-label="Primary">
            <Link className="active-link" to="/docs">
              Guide
            </Link>
          </nav>
        </div>
      </header>

      <main className="analysis-loading-page analysis-loading-page-standalone" aria-live="polite" aria-busy="true">
        <section className="analysis-loading-card" aria-labelledby="analysisLoadingTitle">
          <div className="analysis-loading-orbit" aria-hidden="true">
            <span />
          </div>
          <h1 id="analysisLoadingTitle">
            Analyzing your website
            <span className="analysis-loading-dots" aria-hidden="true" />
          </h1>
          <div className="analysis-loading-progress-row">
            <div className="analysis-loading-progress" aria-hidden="true">
              <span id="analysisLoadingProgressBar" />
            </div>
            <strong id="analysisLoadingPercent" className="analysis-loading-percent">
              8%
            </strong>
          </div>
          <p id="analysisLoadingMessage" className="analysis-loading-message">
            Checking your interface before opening the report
            <span className="analysis-loading-dots" aria-hidden="true" />
          </p>
          <p id="analysisLoadingError" className="analysis-loading-error" hidden />
          <div className="analysis-loading-actions">
            <button id="analysisCancelButton" className="analysis-loading-cancel-button" type="button">
              Cancel
            </button>
          </div>
        </section>
      </main>
    </>
  );
}
