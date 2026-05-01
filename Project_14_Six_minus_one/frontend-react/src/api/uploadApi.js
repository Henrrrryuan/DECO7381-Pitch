import {
  getCurrentBaselineRunIdentifier,
  isHtmlFile,
  isSupportedUploadFile,
  isZipFile,
  normalizeWebsiteAddress,
  persistEyeTrackingTargetAddress,
  readSelectedFileAsDataAddress,
  savePendingAnalysisPayload,
} from "../utils/uploadUtils.js";

// Workflow boundary for starting analysis from the Vite Home page.
//
// This file does not call the backend directly. Instead, it prepares the exact
// sessionStorage payload that the older frontend/loading.js page already knows
// how to read. HomePage.jsx owns the user interaction, this file owns the saved
// payload shape, and loading.js continues the backend analysis process.

export function prepareWebsiteAnalysis(websiteAddressInputValue) {
  const normalizedWebsiteAddress = normalizeWebsiteAddress(websiteAddressInputValue);
  const baselineRunIdentifier = getCurrentBaselineRunIdentifier();

  persistEyeTrackingTargetAddress(normalizedWebsiteAddress);
  savePendingAnalysisPayload({
    mode: "url",
    url: normalizedWebsiteAddress,
    baselineRunId: baselineRunIdentifier,
    createdAt: new Date().toISOString(),
  });

  return normalizedWebsiteAddress;
}

export async function prepareFileAnalysis(selectedUploadFile) {
  if (!selectedUploadFile || !isSupportedUploadFile(selectedUploadFile)) {
    throw new Error("Only HTML and ZIP files are supported on the upload page.");
  }

  const baselineRunIdentifier = getCurrentBaselineRunIdentifier();
  const pendingAnalysisPayload = {
    mode: "file",
    fileName: selectedUploadFile.name,
    fileType: selectedUploadFile.type || "",
    sourceType: isZipFile(selectedUploadFile) ? "zip" : "html",
    baselineRunId: baselineRunIdentifier,
    createdAt: new Date().toISOString(),
  };

  if (isZipFile(selectedUploadFile)) {
    pendingAnalysisPayload.fileDataUrl = await readSelectedFileAsDataAddress(selectedUploadFile);
  } else if (isHtmlFile(selectedUploadFile)) {
    pendingAnalysisPayload.html = await selectedUploadFile.text();
  }

  savePendingAnalysisPayload(pendingAnalysisPayload);
  return selectedUploadFile.name;
}
