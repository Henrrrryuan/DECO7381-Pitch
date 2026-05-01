import { useCallback, useEffect, useRef, useState } from "react";

import {
  analyzeHtmlText,
  analyzeVisualComplexityHtml,
  analyzeVisualComplexityWebsiteAddress,
  analyzeWebsiteAddress,
  analyzeZipFile,
} from "../api/analysisApi.js";
import { AppNav } from "../components/AppNav.jsx";
import {
  clearPendingAnalysisPayload,
  createAnalysisCancelledError,
  createFileFromDataAddress,
  loadPendingAnalysisPayload,
  MINIMUM_LOADING_TIME_MS,
  openOldDashboardForRun,
  saveViteDashboardSession,
  wait,
} from "../utils/loadingUtils.js";

let loadingWorkflowHasStarted = false;

// Page controller for the Vite Loading workflow.
//
// HomePage.jsx saves a pending-analysis payload in sessionStorage and navigates
// here. LoadingPage.jsx reads that payload, calls api/analysisApi.js to run the
// backend analysis, attaches visual complexity evidence, then opens the older
// dashboard.html page by run_id. The JSX keeps the old loading.html class names
// so the visual design stays the same while the implementation moves to React.
export function LoadingPage() {
  const [loadingMessage, setLoadingMessage] = useState("Checking your interface before opening the report");
  const [loadingPercent, setLoadingPercent] = useState(8);
  const [loadingError, setLoadingError] = useState("");
  const [cancelButtonText, setCancelButtonText] = useState("Cancel");
  const [cancelButtonIsDisabled, setCancelButtonIsDisabled] = useState(false);
  const cancelRequestedRef = useRef(false);

  const setProgress = useCallback((nextProgressValue) => {
    setLoadingPercent((currentProgressValue) => (
      Math.max(currentProgressValue, Math.min(100, Math.round(nextProgressValue)))
    ));
  }, []);

  const ensureAnalysisNotCancelled = useCallback(() => {
    if (cancelRequestedRef.current) {
      throw createAnalysisCancelledError();
    }
  }, []);

  const analyzePendingFile = useCallback(async (pendingAnalysisPayload) => {
    ensureAnalysisNotCancelled();
    if (pendingAnalysisPayload.sourceType === "zip") {
      setProgress(24);
      setLoadingMessage("Reading the uploaded package");
      const selectedZipFile = await createFileFromDataAddress(
        pendingAnalysisPayload.fileDataUrl,
        pendingAnalysisPayload.fileName,
        pendingAnalysisPayload.fileType,
      );
      ensureAnalysisNotCancelled();
      setProgress(38);
      const payload = await analyzeZipFile({
        selectedZipFile,
        baselineRunIdentifier: pendingAnalysisPayload.baselineRunId || null,
      });
      ensureAnalysisNotCancelled();
      return {
        payload,
        htmlContent: payload.html_content || "",
        sourceName: pendingAnalysisPayload.fileName,
        sourceType: "zip",
        sourceUrl: "",
      };
    }

    setProgress(28);
    setLoadingMessage("Reading the uploaded HTML");
    const htmlContent = pendingAnalysisPayload.html || "";
    setProgress(42);
    const payload = await analyzeHtmlText({
      htmlContent,
      sourceName: pendingAnalysisPayload.fileName || "uploaded.html",
      baselineRunIdentifier: pendingAnalysisPayload.baselineRunId || null,
    });
    ensureAnalysisNotCancelled();
    return {
      payload,
      htmlContent,
      sourceName: pendingAnalysisPayload.fileName || "uploaded.html",
      sourceType: "html",
      sourceUrl: "",
    };
  }, [ensureAnalysisNotCancelled, setProgress]);

  const analyzePendingWebsiteAddress = useCallback(async (pendingAnalysisPayload) => {
    ensureAnalysisNotCancelled();
    setProgress(24);
    setLoadingMessage("Fetching the live page");
    const payload = await analyzeWebsiteAddress({
      websiteAddress: pendingAnalysisPayload.url,
      baselineRunIdentifier: pendingAnalysisPayload.baselineRunId || null,
    });
    ensureAnalysisNotCancelled();
    return {
      payload,
      htmlContent: payload.html_content || "",
      sourceName: payload.resource_bundle?.entry_name || payload.run?.source_name || pendingAnalysisPayload.url,
      sourceType: "url",
      sourceUrl: pendingAnalysisPayload.url,
    };
  }, [ensureAnalysisNotCancelled, setProgress]);

  const attachVisualComplexity = useCallback(async (analysisResult, pendingAnalysisPayload) => {
    ensureAnalysisNotCancelled();
    setProgress(68);
    setLoadingMessage("Checking visual complexity");

    try {
      if (pendingAnalysisPayload.mode === "url" && pendingAnalysisPayload.url) {
        analysisResult.payload.visual_complexity = await analyzeVisualComplexityWebsiteAddress(
          pendingAnalysisPayload.url,
        );
        ensureAnalysisNotCancelled();
        return;
      }

      analysisResult.payload.visual_complexity = await analyzeVisualComplexityHtml(
        analysisResult.htmlContent || "",
      );
      ensureAnalysisNotCancelled();
    } catch (error) {
      ensureAnalysisNotCancelled();
      analysisResult.payload.visual_complexity_error = error.message || String(error);
      if (pendingAnalysisPayload.mode === "url" && analysisResult.htmlContent) {
        try {
          analysisResult.payload.visual_complexity = await analyzeVisualComplexityHtml(
            analysisResult.htmlContent,
          );
          ensureAnalysisNotCancelled();
        } catch (fallbackError) {
          analysisResult.payload.visual_complexity_error = fallbackError.message || String(fallbackError);
        }
      }
    }
  }, [ensureAnalysisNotCancelled, setProgress]);

  const runPendingAnalysis = useCallback(async () => {
    const startedAt = Date.now();
    try {
      ensureAnalysisNotCancelled();
      const pendingAnalysisPayload = loadPendingAnalysisPayload();
      setProgress(12);

      const analysisResult = pendingAnalysisPayload.mode === "url"
        ? await analyzePendingWebsiteAddress(pendingAnalysisPayload)
        : await analyzePendingFile(pendingAnalysisPayload);

      ensureAnalysisNotCancelled();
      await attachVisualComplexity(analysisResult, pendingAnalysisPayload);
      ensureAnalysisNotCancelled();
      setProgress(86);
      setLoadingMessage("Preparing the report");
      saveViteDashboardSession(analysisResult);
      clearPendingAnalysisPayload();

      const elapsedMilliseconds = Date.now() - startedAt;
      if (elapsedMilliseconds < MINIMUM_LOADING_TIME_MS) {
        await wait(MINIMUM_LOADING_TIME_MS - elapsedMilliseconds);
      }
      ensureAnalysisNotCancelled();
      setProgress(100);
      await wait(350);
      ensureAnalysisNotCancelled();

      const runIdentifier = analysisResult.payload?.run?.run_id || "";
      if (!runIdentifier) {
        throw new Error("Analysis finished, but no Report ID was returned.");
      }
      openOldDashboardForRun(runIdentifier);
    } catch (error) {
      if (cancelRequestedRef.current || error?.name === "AnalysisCancelledError") {
        return;
      }
      setLoadingMessage("");
      setLoadingError(error.message || String(error));
    }
  }, [
    analyzePendingFile,
    analyzePendingWebsiteAddress,
    attachVisualComplexity,
    ensureAnalysisNotCancelled,
    setProgress,
  ]);

  const handleCancelAnalysis = useCallback(() => {
    if (cancelRequestedRef.current) {
      return;
    }
    cancelRequestedRef.current = true;
    clearPendingAnalysisPayload();
    setLoadingError("");
    setLoadingMessage("Cancelling and returning to home");
    setCancelButtonIsDisabled(true);
    setCancelButtonText("Cancelling...");
    window.location.href = "/";
  }, []);

  useEffect(() => {
    document.body.classList.add("upload-body", "loading-body");
    document.body.classList.remove("gaze-preview-hidden");
    if (!loadingWorkflowHasStarted) {
      loadingWorkflowHasStarted = true;
      runPendingAnalysis();
    }
    return () => {
      document.body.classList.remove("loading-body");
    };
  }, [runPendingAnalysis]);

  return (
    <>
      <AppNav activePage="loading" />
      <main
        className="analysis-loading-page analysis-loading-page-standalone"
        aria-live="polite"
        aria-busy={loadingError ? "false" : "true"}
      >
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
              <span style={{ width: `${loadingPercent}%` }} />
            </div>
            <strong className="analysis-loading-percent">{`${loadingPercent}%`}</strong>
          </div>
          {loadingMessage ? (
            <p className="analysis-loading-message">
              {loadingMessage}
              <span className="analysis-loading-dots" aria-hidden="true" />
            </p>
          ) : null}
          {loadingError ? (
            <p className="analysis-loading-error">{loadingError}</p>
          ) : null}
          <div className="analysis-loading-actions">
            <button
              className="analysis-loading-cancel-button"
              type="button"
              disabled={cancelButtonIsDisabled}
              onClick={handleCancelAnalysis}
            >
              {cancelButtonText}
            </button>
          </div>
        </section>
      </main>
    </>
  );
}
