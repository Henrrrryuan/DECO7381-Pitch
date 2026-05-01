import { useCallback, useEffect, useState } from "react";

import {
  prepareFileAnalysis,
  prepareWebsiteAnalysis,
} from "../api/uploadApi.js";
import { AppNav } from "../components/AppNav.jsx";
import { FileUploadPanel } from "../components/home/FileUploadPanel.jsx";
import { HomeMascot } from "../components/home/HomeMascot.jsx";
import { InputMethodTabs } from "../components/home/InputMethodTabs.jsx";
import { WebsiteAnalysisPanel } from "../components/home/WebsiteAnalysisPanel.jsx";
import {
  EYE_TARGET_WEBSITE_ADDRESS_STORAGE_KEY,
  LOADING_PAGE_ROUTE,
  persistEyeTrackingTargetAddress,
} from "../utils/uploadUtils.js";

// Page controller for the Vite Home / Upload workflow.
//
// This page owns the state for the input method, URL text, selected file,
// drag-and-drop state, loading state, and status message. Presentation
// components under components/home/ render each section and call the callbacks
// defined here. api/uploadApi.js prepares the sessionStorage payload that the
// older loading.js page consumes before it calls the existing backend analysis
// endpoints.
export function HomePage() {
  const [selectedInputMethod, setSelectedInputMethod] = useState("website");
  const [websiteAddressInputValue, setWebsiteAddressInputValue] = useState("");
  const [selectedUploadFile, setSelectedUploadFile] = useState(null);
  const [fileDropIsActive, setFileDropIsActive] = useState(false);
  const [analysisIsStarting, setAnalysisIsStarting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusIsError, setStatusIsError] = useState(false);

  const setWorkflowStatus = useCallback((message, isError = false) => {
    setStatusMessage(message);
    setStatusIsError(isError);
  }, []);

  const startLoadingPage = useCallback(() => {
    window.location.href = LOADING_PAGE_ROUTE;
  }, []);

  const handleWebsiteAddressInputChange = useCallback((nextWebsiteAddress) => {
    setWebsiteAddressInputValue(nextWebsiteAddress);
    setWorkflowStatus("");
    persistEyeTrackingTargetAddress(nextWebsiteAddress);
  }, [setWorkflowStatus]);

  const handleWebsiteAnalysisSubmit = useCallback((event) => {
    event.preventDefault();
    if (analysisIsStarting) {
      return;
    }

    setAnalysisIsStarting(true);
    setWorkflowStatus("Preparing the analysis page...");

    try {
      prepareWebsiteAnalysis(websiteAddressInputValue);
      startLoadingPage();
    } catch (error) {
      setWorkflowStatus(error.message || String(error), true);
      setAnalysisIsStarting(false);
    }
  }, [
    analysisIsStarting,
    startLoadingPage,
    setWorkflowStatus,
    websiteAddressInputValue,
  ]);

  const handleFileAnalysisSubmit = useCallback(async (event) => {
    event.preventDefault();
    if (analysisIsStarting || !selectedUploadFile) {
      return;
    }

    setAnalysisIsStarting(true);
    setWorkflowStatus("Preparing the uploaded file...");

    try {
      await prepareFileAnalysis(selectedUploadFile);
      startLoadingPage();
    } catch (error) {
      setWorkflowStatus(error.message || String(error), true);
      setAnalysisIsStarting(false);
    }
  }, [
    analysisIsStarting,
    selectedUploadFile,
    startLoadingPage,
    setWorkflowStatus,
  ]);

  useEffect(() => {
    document.body.classList.remove("gaze-preview-hidden");
    try {
      const storedWebsiteAddress = localStorage.getItem(EYE_TARGET_WEBSITE_ADDRESS_STORAGE_KEY) || "";
      if (storedWebsiteAddress) {
        setWebsiteAddressInputValue(storedWebsiteAddress);
      }
    } catch (_) {
      setWebsiteAddressInputValue("");
    }
  }, []);

  useEffect(() => {
    const handlePageShow = () => {
      setAnalysisIsStarting(false);
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  return (
    <>
      <AppNav activePage="home" />
      <main className="upload-page">
        <section className="upload-hero">
          <div className="upload-copy">
            <h1>Cognitive Accessibility Evaluation</h1>
          </div>

          <section className="input-workflow" aria-label="CogniLens input workflow">
            <div className="workflow-card">
              <HomeMascot />
              <InputMethodTabs
                selectedInputMethod={selectedInputMethod}
                onSelectedInputMethodChange={setSelectedInputMethod}
              />

              <div className="workflow-panels">
                {selectedInputMethod === "website" ? (
                  <WebsiteAnalysisPanel
                    websiteAddressInputValue={websiteAddressInputValue}
                    analysisIsStarting={analysisIsStarting}
                    onWebsiteAddressInputChange={handleWebsiteAddressInputChange}
                    onWebsiteAnalysisSubmit={handleWebsiteAnalysisSubmit}
                  />
                ) : (
                  <FileUploadPanel
                    selectedUploadFile={selectedUploadFile}
                    fileDropIsActive={fileDropIsActive}
                    analysisIsStarting={analysisIsStarting}
                    onSelectedUploadFileChange={setSelectedUploadFile}
                    onFileDropActiveChange={setFileDropIsActive}
                    onFileAnalysisSubmit={handleFileAnalysisSubmit}
                    onStatusMessageChange={setWorkflowStatus}
                  />
                )}
              </div>
            </div>
          </section>

          <p className={`upload-status${statusIsError ? " error" : ""}`} aria-live="polite">
            {statusMessage}
          </p>
        </section>
      </main>
    </>
  );
}
