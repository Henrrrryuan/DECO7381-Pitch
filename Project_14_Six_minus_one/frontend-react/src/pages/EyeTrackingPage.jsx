import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buildEyeProxyUrl, saveEyeTrackingSession } from "../api/eyeApi.js";
import { AppNav } from "../components/AppNav.jsx";
import { EvidenceSummary } from "../components/eye/EvidenceSummary.jsx";
import { EyeEvidenceIntro } from "../components/eye/EyeEvidenceIntro.jsx";
import { RecordingControls } from "../components/eye/RecordingControls.jsx";
import { ReportLinkPanel } from "../components/eye/ReportLinkPanel.jsx";
import { TestPagePanel } from "../components/eye/TestPagePanel.jsx";
import { TrackingViewport } from "../components/eye/TrackingViewport.jsx";
import {
  ANALYSIS_RETURN_URL_STORAGE_KEY,
  clamp,
  distanceBetweenPoints,
  formatDuration,
  getErrorMessage,
  loadGazeCloudApi,
  normalizeTargetUrl,
  persistPreferredTargetUrl,
  readPreferredTargetUrl,
} from "../utils/eyeTrackingUtils.js";

const HEAT_SAMPLE_INTERVAL_MS = 45;
const HEAT_MIN_DISTANCE_PX = 4;
const DEFAULT_TARGET_URL = "https://example.com";

function createTrackingState() {
  const gridCols = 24;
  const gridRows = 14;
  return {
    started: false,
    paused: false,
    calibrated: false,
    lastTrackerState: null,
    samples: 0,
    filteredPoint: null,
    lastRawPoint: null,
    lastSampleTime: 0,
    lastHeatSampleTime: 0,
    lastHeatPoint: null,
    gridCols,
    gridRows,
    cellCounts: new Array(gridCols * gridRows).fill(0),
    visitedCellIds: new Set(),
    heatSamples: [],
    sessionStartPerf: 0,
    sessionStartedAtIso: "",
    pausedDurationMs: 0,
    pausedAtPerf: 0,
    saving: false,
  };
}

// Page controller for the Vite Eye Tracking workflow.
//
// This page keeps the existing eye-tracking mechanics from the older
// eye/app.js file, but organizes the UI into React workflow sections:
// ReportLinkPanel, TestPagePanel, RecordingControls, TrackingViewport, and
// EvidenceSummary. The components render values and trigger callbacks, while
// this page owns GazeCloudAPI callbacks, iframe proxy loading, heatmap drawing,
// coverage calculation, and saving evidence to the backend.
export function EyeTrackingPage() {
  const searchParameters = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialTargetUrl = readPreferredTargetUrl(searchParameters) || DEFAULT_TARGET_URL;
  const initialReportId = searchParameters.get("run_id") || "";
  const initialSourceName = searchParameters.get("source_name") || "";

  const [targetUrlInput, setTargetUrlInput] = useState(initialTargetUrl);
  const [currentTargetUrl, setCurrentTargetUrl] = useState("");
  const [targetFrameSource, setTargetFrameSource] = useState("");
  const [relatedReportId, setRelatedReportId] = useState(initialReportId);
  const [sourceName, setSourceName] = useState(initialSourceName);
  const [statusMessage, setStatusMessage] = useState('Idle - load a page, then click "Start Tracking".');
  const [frameHint, setFrameHint] = useState("Page is loaded through local proxy mode for better compatibility.");
  const [coordinatesText, setCoordinatesText] = useState("x: -, y: -");
  const [sampleCount, setSampleCount] = useState(0);
  const [coveragePercent, setCoveragePercent] = useState(0);
  const [durationMilliseconds, setDurationMilliseconds] = useState(0);
  const [isStarted, setIsStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedSessionId, setLastSavedSessionId] = useState("");
  const [returnToAnalysisUrl, setReturnToAnalysisUrl] = useState("");

  const targetFrameRef = useRef(null);
  const viewportShellRef = useRef(null);
  const heatmapCanvasRef = useRef(null);
  const coverageCanvasRef = useRef(null);
  const gazeDotRef = useRef(null);
  const heatmapContextRef = useRef(null);
  const coverageContextRef = useRef(null);
  const trackingStateRef = useRef(createTrackingState());
  const detachFrameScrollListenerRef = useRef(null);

  const canSave = Boolean(currentTargetUrl) && sampleCount > 0 && !isSaving;
  const durationText = formatDuration(durationMilliseconds);

  const getViewportRect = useCallback(() => {
    const viewportElement = viewportShellRef.current;
    return viewportElement?.getBoundingClientRect() || {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      width: 0,
      height: 0,
    };
  }, []);

  const currentCoveragePercent = useCallback(() => {
    const trackingState = trackingStateRef.current;
    if (!trackingState.gridCols || !trackingState.gridRows) {
      return 0;
    }
    return Number(
      (
        (trackingState.visitedCellIds.size / (trackingState.gridCols * trackingState.gridRows)) *
        100
      ).toFixed(1),
    );
  }, []);

  const currentDurationMs = useCallback(() => {
    const trackingState = trackingStateRef.current;
    if (!trackingState.sessionStartPerf) {
      return 0;
    }
    const now = trackingState.paused && trackingState.pausedAtPerf
      ? trackingState.pausedAtPerf
      : performance.now();
    return Math.max(0, Math.round(now - trackingState.sessionStartPerf - trackingState.pausedDurationMs));
  }, []);

  const getFrameDocument = useCallback(() => {
    const targetFrame = targetFrameRef.current;
    if (!targetFrame) {
      return null;
    }
    try {
      return targetFrame.contentDocument || targetFrame.contentWindow?.document || null;
    } catch (_) {
      return null;
    }
  }, []);

  const getFrameWindow = useCallback(() => {
    const targetFrame = targetFrameRef.current;
    if (!targetFrame) {
      return null;
    }
    try {
      return targetFrame.contentWindow || null;
    } catch (_) {
      return null;
    }
  }, []);

  const getFrameScrollOffsets = useCallback(() => {
    const frameWindow = getFrameWindow();
    const frameDocument = getFrameDocument();
    const rootElement = frameDocument?.documentElement;
    const bodyElement = frameDocument?.body;

    return {
      x: Math.max(0, frameWindow?.scrollX ?? rootElement?.scrollLeft ?? bodyElement?.scrollLeft ?? 0),
      y: Math.max(0, frameWindow?.scrollY ?? rootElement?.scrollTop ?? bodyElement?.scrollTop ?? 0),
    };
  }, [getFrameDocument, getFrameWindow]);

  const getFrameDocumentSize = useCallback(() => {
    const viewportRect = getViewportRect();
    const frameDocument = getFrameDocument();
    const rootElement = frameDocument?.documentElement;
    const bodyElement = frameDocument?.body;

    return {
      width: Math.max(
        viewportRect.width,
        rootElement?.scrollWidth ?? 0,
        rootElement?.clientWidth ?? 0,
        bodyElement?.scrollWidth ?? 0,
        bodyElement?.clientWidth ?? 0,
      ),
      height: Math.max(
        viewportRect.height,
        rootElement?.scrollHeight ?? 0,
        rootElement?.clientHeight ?? 0,
        bodyElement?.scrollHeight ?? 0,
        bodyElement?.clientHeight ?? 0,
      ),
    };
  }, [getFrameDocument, getViewportRect]);

  const getPointInsideFrame = useCallback((clientPoint) => {
    const targetFrame = targetFrameRef.current;
    if (!targetFrame || !clientPoint) {
      return null;
    }

    const frameRect = targetFrame.getBoundingClientRect();
    return {
      x: clientPoint.x - frameRect.left,
      y: clientPoint.y - frameRect.top,
    };
  }, []);

  const isViewportAnchoredElement = useCallback((clientPoint) => {
    const targetFrame = targetFrameRef.current;
    const frameDocument = getFrameDocument();
    const frameWindow = getFrameWindow();
    const framePoint = getPointInsideFrame(clientPoint);

    if (!targetFrame || !frameDocument || !frameWindow || !framePoint) {
      return false;
    }

    if (
      framePoint.x < 0 ||
      framePoint.y < 0 ||
      framePoint.x > targetFrame.clientWidth ||
      framePoint.y > targetFrame.clientHeight
    ) {
      return false;
    }

    const elementAtPoint = frameDocument.elementFromPoint(framePoint.x, framePoint.y);
    if (!elementAtPoint) {
      return false;
    }

    let currentElement = elementAtPoint;
    while (currentElement && currentElement.nodeType === 1) {
      const computedStyle = frameWindow.getComputedStyle(currentElement);
      if (computedStyle.position === "fixed" || computedStyle.position === "sticky") {
        return true;
      }
      currentElement = currentElement.parentElement;
    }

    return false;
  }, [getFrameDocument, getFrameWindow, getPointInsideFrame]);

  const drawHeatPoint = useCallback((x, y) => {
    const heatmapContext = heatmapContextRef.current;
    if (!heatmapContext) {
      return;
    }

    const radius = 72;
    const gradient = heatmapContext.createRadialGradient(x, y, 2, x, y, radius);
    gradient.addColorStop(0, "rgba(239, 68, 68, 0.22)");
    gradient.addColorStop(0.5, "rgba(245, 158, 11, 0.10)");
    gradient.addColorStop(1, "rgba(245, 158, 11, 0)");

    heatmapContext.fillStyle = gradient;
    heatmapContext.beginPath();
    heatmapContext.arc(x, y, radius, 0, Math.PI * 2);
    heatmapContext.fill();
  }, []);

  const renderHeatmap = useCallback(() => {
    const heatmapContext = heatmapContextRef.current;
    if (!heatmapContext) {
      return;
    }

    const viewportRect = getViewportRect();
    const scrollOffsets = getFrameScrollOffsets();
    heatmapContext.clearRect(0, 0, viewportRect.width, viewportRect.height);

    for (const heatSample of trackingStateRef.current.heatSamples) {
      const x = heatSample.anchorToViewport ? heatSample.docX : heatSample.docX - scrollOffsets.x;
      const y = heatSample.anchorToViewport ? heatSample.docY : heatSample.docY - scrollOffsets.y;

      if (x < -80 || x > viewportRect.width + 80 || y < -80 || y > viewportRect.height + 80) {
        continue;
      }

      drawHeatPoint(x, y);
    }
  }, [drawHeatPoint, getFrameScrollOffsets, getViewportRect]);

  const drawCoverageMap = useCallback(() => {
    const coverageCanvas = coverageCanvasRef.current;
    const coverageContext = coverageContextRef.current;
    if (!coverageCanvas || !coverageContext) {
      return;
    }

    const trackingState = trackingStateRef.current;
    const width = coverageCanvas.width;
    const height = coverageCanvas.height;
    coverageContext.clearRect(0, 0, width, height);
    coverageContext.fillStyle = "#f8fafc";
    coverageContext.fillRect(0, 0, width, height);

    const cellWidth = width / trackingState.gridCols;
    const cellHeight = height / trackingState.gridRows;

    for (let rowIndex = 0; rowIndex < trackingState.gridRows; rowIndex += 1) {
      for (let columnIndex = 0; columnIndex < trackingState.gridCols; columnIndex += 1) {
        const cellIndex = rowIndex * trackingState.gridCols + columnIndex;
        const count = trackingState.cellCounts[cellIndex];
        if (!count) {
          continue;
        }
        const strength = clamp(count / 20, 0.08, 1);
        coverageContext.fillStyle = `rgba(37, 99, 235, ${strength})`;
        coverageContext.fillRect(
          columnIndex * cellWidth,
          rowIndex * cellHeight,
          cellWidth,
          cellHeight,
        );
      }
    }

    coverageContext.strokeStyle = "rgba(100, 116, 139, 0.24)";
    coverageContext.lineWidth = 1;
    for (let columnIndex = 1; columnIndex < trackingState.gridCols; columnIndex += 1) {
      const x = Math.round(columnIndex * cellWidth) + 0.5;
      coverageContext.beginPath();
      coverageContext.moveTo(x, 0);
      coverageContext.lineTo(x, height);
      coverageContext.stroke();
    }
    for (let rowIndex = 1; rowIndex < trackingState.gridRows; rowIndex += 1) {
      const y = Math.round(rowIndex * cellHeight) + 0.5;
      coverageContext.beginPath();
      coverageContext.moveTo(0, y);
      coverageContext.lineTo(width, y);
      coverageContext.stroke();
    }
  }, []);

  const updateCoverage = useCallback((x, y, width, height) => {
    if (!width || !height) {
      return;
    }
    const trackingState = trackingStateRef.current;
    const columnIndex = clamp(Math.floor((x / width) * trackingState.gridCols), 0, trackingState.gridCols - 1);
    const rowIndex = clamp(Math.floor((y / height) * trackingState.gridRows), 0, trackingState.gridRows - 1);
    const cellIndex = rowIndex * trackingState.gridCols + columnIndex;
    trackingState.cellCounts[cellIndex] += 1;
    trackingState.visitedCellIds.add(cellIndex);

    setCoveragePercent(currentCoveragePercent());
  }, [currentCoveragePercent]);

  const resizeHeatmapCanvas = useCallback(() => {
    const heatmapCanvas = heatmapCanvasRef.current;
    const heatmapContext = heatmapContextRef.current;
    if (!heatmapCanvas || !heatmapContext) {
      return;
    }

    const devicePixelRatio = window.devicePixelRatio || 1;
    const viewportRect = getViewportRect();
    heatmapCanvas.width = Math.max(1, Math.floor(viewportRect.width * devicePixelRatio));
    heatmapCanvas.height = Math.max(1, Math.floor(viewportRect.height * devicePixelRatio));
    heatmapContext.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }, [getViewportRect]);

  const resetTrackingData = useCallback(() => {
    const trackingState = trackingStateRef.current;
    const heatmapContext = heatmapContextRef.current;
    const viewportRect = getViewportRect();
    if (heatmapContext) {
      heatmapContext.clearRect(0, 0, viewportRect.width, viewportRect.height);
    }

    trackingState.samples = 0;
    trackingState.filteredPoint = null;
    trackingState.lastRawPoint = null;
    trackingState.lastSampleTime = 0;
    trackingState.lastHeatSampleTime = 0;
    trackingState.lastHeatPoint = null;
    trackingState.heatSamples = [];
    trackingState.pausedDurationMs = 0;
    trackingState.pausedAtPerf = 0;
    trackingState.sessionStartPerf = trackingState.started ? performance.now() : 0;
    trackingState.sessionStartedAtIso = trackingState.started ? new Date().toISOString() : "";
    trackingState.cellCounts.fill(0);
    trackingState.visitedCellIds.clear();

    setSampleCount(0);
    setCoveragePercent(0);
    setDurationMilliseconds(0);
    setCoordinatesText("x: -, y: -");
    setLastSavedSessionId("");
    if (gazeDotRef.current) {
      gazeDotRef.current.style.opacity = "0";
    }
    drawCoverageMap();
  }, [drawCoverageMap, getViewportRect]);

  const attachFrameScrollTracking = useCallback(() => {
    if (detachFrameScrollListenerRef.current) {
      detachFrameScrollListenerRef.current();
      detachFrameScrollListenerRef.current = null;
    }

    const frameWindow = getFrameWindow();
    if (!frameWindow) {
      return;
    }

    let animationFrameId = 0;
    const handleFrameScroll = () => {
      if (animationFrameId) {
        return;
      }
      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = 0;
        renderHeatmap();
      });
    };

    frameWindow.addEventListener("scroll", handleFrameScroll, { passive: true });
    detachFrameScrollListenerRef.current = () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
      frameWindow.removeEventListener("scroll", handleFrameScroll);
    };
  }, [getFrameWindow, renderHeatmap]);

  const loadTargetUrl = useCallback((rawInput) => {
    try {
      if (detachFrameScrollListenerRef.current) {
        detachFrameScrollListenerRef.current();
        detachFrameScrollListenerRef.current = null;
      }
      const normalizedUrl = normalizeTargetUrl(rawInput);
      setCurrentTargetUrl(normalizedUrl);
      setTargetUrlInput(normalizedUrl);
      setTargetFrameSource(buildEyeProxyUrl(normalizedUrl));
      persistPreferredTargetUrl(normalizedUrl);
      setFrameHint("Page is loaded through local proxy mode. Dynamic or login-heavy sites may behave differently.");
      resetTrackingData();
      setStatusMessage(`Loading page: ${normalizedUrl}`);
    } catch (error) {
      setStatusMessage(getErrorMessage(error));
    }
  }, [resetTrackingData]);

  const handleLoadTargetUrl = useCallback((event) => {
    event.preventDefault();
    loadTargetUrl(targetUrlInput);
  }, [loadTargetUrl, targetUrlInput]);

  const captureHtmlSnapshot = useCallback(() => {
    const frameDocument = getFrameDocument();
    return frameDocument?.documentElement?.outerHTML || "";
  }, [getFrameDocument]);

  const deriveSessionSourceName = useCallback(() => {
    const explicitSourceName = String(sourceName || "").trim();
    if (explicitSourceName) {
      return explicitSourceName;
    }
    if (currentTargetUrl) {
      try {
        const parsedUrl = new URL(currentTargetUrl);
        return parsedUrl.hostname || currentTargetUrl;
      } catch (_) {
        return currentTargetUrl;
      }
    }
    return "Eye Tracking Session";
  }, [currentTargetUrl, sourceName]);

  const buildEyeSessionPayload = useCallback(() => {
    const trackingState = trackingStateRef.current;
    return {
      run_id: relatedReportId.trim() || null,
      source_name: deriveSessionSourceName(),
      target_url: currentTargetUrl || "",
      html_snapshot: captureHtmlSnapshot(),
      sample_count: trackingState.samples,
      duration_ms: currentDurationMs(),
      coverage_percent: currentCoveragePercent(),
      grid_cols: trackingState.gridCols,
      grid_rows: trackingState.gridRows,
      cell_counts: [...trackingState.cellCounts],
      summary: {
        saved_at: new Date().toISOString(),
        session_started_at: trackingState.sessionStartedAtIso || null,
        visited_cells: trackingState.visitedCellIds.size,
        page_route: "vite-eye-tracking",
      },
    };
  }, [
    captureHtmlSnapshot,
    currentCoveragePercent,
    currentDurationMs,
    currentTargetUrl,
    deriveSessionSourceName,
    relatedReportId,
  ]);

  const saveCurrentSession = useCallback(async () => {
    const trackingState = trackingStateRef.current;
    if (trackingState.saving) {
      return;
    }
    if (!currentTargetUrl || trackingState.samples <= 0) {
      setStatusMessage("Track a page first before saving an eye session.");
      return;
    }

    trackingState.saving = true;
    setIsSaving(true);

    try {
      const responsePayload = await saveEyeTrackingSession(buildEyeSessionPayload());
      const sessionId = responsePayload?.session?.session_id || "";
      setLastSavedSessionId(sessionId);
      setStatusMessage(
        sessionId
          ? `Eye session saved to history (${sessionId.slice(0, 8).toUpperCase()}).`
          : "Eye session saved to history.",
      );
    } catch (error) {
      setStatusMessage(`Failed to save eye session: ${getErrorMessage(error)}`);
    } finally {
      trackingState.saving = false;
      setIsSaving(false);
    }
  }, [buildEyeSessionPayload, currentTargetUrl]);

  const handleTrackerStop = useCallback((message) => {
    const trackingState = trackingStateRef.current;
    trackingState.started = false;
    trackingState.paused = false;
    trackingState.calibrated = false;
    trackingState.lastTrackerState = null;
    setIsStarted(false);
    setIsPaused(false);
    setIsPreviewVisible(false);
    if (gazeDotRef.current) {
      gazeDotRef.current.style.opacity = "0";
    }
    setStatusMessage(message);
  }, []);

  const updateTrackerState = useCallback((gazeState) => {
    const trackingState = trackingStateRef.current;
    if (trackingState.lastTrackerState === gazeState || trackingState.paused) {
      return;
    }

    trackingState.lastTrackerState = gazeState;

    if (gazeState === 0) {
      setStatusMessage("Tracking active. Move your eyes naturally.");
      return;
    }

    if (gazeState === 1) {
      setStatusMessage("Calibration in progress. Follow the GazeCloudAPI overlay.");
      return;
    }

    if (gazeState === -1) {
      if (gazeDotRef.current) {
        gazeDotRef.current.style.opacity = "0";
      }
      setStatusMessage(
        trackingState.calibrated
          ? "Face tracking lost. Keep your face centered in the camera."
          : "Waiting for face detection...",
      );
    }
  }, []);

  const getGazeClientPoint = useCallback((gazeData) => {
    if (Number.isFinite(gazeData.docX) && Number.isFinite(gazeData.docY)) {
      return {
        x: gazeData.docX - window.scrollX,
        y: gazeData.docY - window.scrollY,
      };
    }

    if (Number.isFinite(gazeData.x) && Number.isFinite(gazeData.y)) {
      return { x: gazeData.x, y: gazeData.y };
    }

    return null;
  }, []);

  const handleGaze = useCallback((gazeData) => {
    const trackingState = trackingStateRef.current;
    if (!gazeData || !trackingState.started || trackingState.paused) {
      return;
    }

    if (typeof gazeData.state === "number") {
      if (gazeData.state === 0 && !trackingState.calibrated) {
        trackingState.calibrated = true;
      }
      updateTrackerState(gazeData.state);
      if (gazeData.state !== 0 || !trackingState.calibrated) {
        return;
      }
    }

    const viewportRect = getViewportRect();
    const clientPoint = getGazeClientPoint(gazeData);
    if (!clientPoint) {
      return;
    }

    if (
      clientPoint.x < viewportRect.left ||
      clientPoint.x > viewportRect.right ||
      clientPoint.y < viewportRect.top ||
      clientPoint.y > viewportRect.bottom
    ) {
      if (gazeDotRef.current) {
        gazeDotRef.current.style.opacity = "0";
      }
      return;
    }

    const rawX = clientPoint.x - viewportRect.left;
    const rawY = clientPoint.y - viewportRect.top;
    const now = performance.now();
    const rawPoint = { x: rawX, y: rawY };

    if (!trackingState.filteredPoint) {
      trackingState.filteredPoint = rawPoint;
      trackingState.lastRawPoint = rawPoint;
      trackingState.lastSampleTime = now;
    } else {
      const deltaTime = Math.max((now - trackingState.lastSampleTime) / 1000, 1 / 240);
      const rawMotion = distanceBetweenPoints(rawPoint, trackingState.lastRawPoint);
      const speed = rawMotion / deltaTime;
      const gapToFiltered = distanceBetweenPoints(rawPoint, trackingState.filteredPoint);
      const alpha = speed > 700 ? 0.62 : speed > 260 ? 0.45 : 0.26;
      const deadZone = speed < 120 ? 5.5 : 2.5;

      if (gapToFiltered >= deadZone) {
        trackingState.filteredPoint = {
          x: trackingState.filteredPoint.x + (rawX - trackingState.filteredPoint.x) * alpha,
          y: trackingState.filteredPoint.y + (rawY - trackingState.filteredPoint.y) * alpha,
        };
      }

      trackingState.lastRawPoint = rawPoint;
      trackingState.lastSampleTime = now;
    }

    const x = trackingState.filteredPoint.x;
    const y = trackingState.filteredPoint.y;
    const scrollOffsets = getFrameScrollOffsets();
    const anchorToViewport = isViewportAnchoredElement(clientPoint);
    const documentPoint = {
      x: anchorToViewport ? x : x + scrollOffsets.x,
      y: anchorToViewport ? y : y + scrollOffsets.y,
    };

    if (gazeDotRef.current) {
      gazeDotRef.current.style.opacity = "1";
      gazeDotRef.current.style.left = `${x}px`;
      gazeDotRef.current.style.top = `${y}px`;
    }

    const needHeatSampleByTime = now - trackingState.lastHeatSampleTime >= HEAT_SAMPLE_INTERVAL_MS;
    const needHeatSampleByMove =
      !trackingState.lastHeatPoint ||
      distanceBetweenPoints(trackingState.lastHeatPoint, documentPoint) >= HEAT_MIN_DISTANCE_PX;

    if (needHeatSampleByTime && needHeatSampleByMove) {
      trackingState.heatSamples.push({
        docX: documentPoint.x,
        docY: documentPoint.y,
        anchorToViewport,
      });
      if (trackingState.heatSamples.length > 6000) {
        trackingState.heatSamples.shift();
      }

      const documentSize = getFrameDocumentSize();
      const coveragePoint = {
        x: x + scrollOffsets.x,
        y: y + scrollOffsets.y,
      };

      renderHeatmap();
      updateCoverage(coveragePoint.x, coveragePoint.y, documentSize.width, documentSize.height);
      drawCoverageMap();
      trackingState.lastHeatSampleTime = now;
      trackingState.lastHeatPoint = documentPoint;
    }

    trackingState.samples += 1;
    setSampleCount(trackingState.samples);
    setCoordinatesText(`x: ${Math.round(x)}, y: ${Math.round(y)}`);
  }, [
    drawCoverageMap,
    getFrameDocumentSize,
    getFrameScrollOffsets,
    getGazeClientPoint,
    getViewportRect,
    isViewportAnchoredElement,
    renderHeatmap,
    updateCoverage,
    updateTrackerState,
  ]);

  const beginTracking = useCallback(async () => {
    if (!currentTargetUrl) {
      setStatusMessage("Load a target page before starting eye tracking.");
      return;
    }

    try {
      const gazeCloudApi = await loadGazeCloudApi();
      if (!gazeCloudApi) {
        throw new Error("GazeCloudAPI script did not load.");
      }

      gazeCloudApi.UseClickRecalibration = false;
      gazeCloudApi.OnResult = handleGaze;
      gazeCloudApi.OnCalibrationComplete = () => {
        const trackingState = trackingStateRef.current;
        trackingState.calibrated = true;
        trackingState.lastTrackerState = null;
        if (!trackingState.paused) {
          setStatusMessage("Calibration complete. Tracking active.");
        }
      };
      gazeCloudApi.OnCamDenied = () => {
        handleTrackerStop("Camera access denied.");
      };
      gazeCloudApi.OnError = (message) => {
        handleTrackerStop(`GazeCloudAPI error: ${getErrorMessage(message)}`);
      };
      gazeCloudApi.OnStopGazeFlow = () => {
        if (trackingStateRef.current.started) {
          handleTrackerStop("Tracking stopped.");
        }
      };

      const trackingState = trackingStateRef.current;
      resetTrackingData();
      trackingState.started = true;
      trackingState.paused = false;
      trackingState.calibrated = false;
      trackingState.lastTrackerState = null;
      trackingState.sessionStartPerf = performance.now();
      trackingState.sessionStartedAtIso = new Date().toISOString();
      trackingState.pausedDurationMs = 0;
      trackingState.pausedAtPerf = 0;
      setIsStarted(true);
      setIsPaused(false);
      setIsPreviewVisible(true);
      setStatusMessage("Starting GazeCloudAPI. Allow camera access and follow the calibration overlay.");
      gazeCloudApi.StartEyeTracking();
    } catch (error) {
      handleTrackerStop(`Failed to start: ${getErrorMessage(error)}`);
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }, [currentTargetUrl, handleGaze, handleTrackerStop, resetTrackingData]);

  const togglePause = useCallback(() => {
    const trackingState = trackingStateRef.current;
    if (!trackingState.started) {
      return;
    }
    if (trackingState.paused) {
      trackingState.paused = false;
      if (trackingState.pausedAtPerf) {
        trackingState.pausedDurationMs += performance.now() - trackingState.pausedAtPerf;
        trackingState.pausedAtPerf = 0;
      }
      trackingState.lastTrackerState = null;
      setIsPaused(false);
      setStatusMessage(
        trackingState.calibrated
          ? "Tracking resumed."
          : "Calibration in progress. Follow the GazeCloudAPI overlay.",
      );
    } else {
      trackingState.paused = true;
      trackingState.pausedAtPerf = performance.now();
      setIsPaused(true);
      if (gazeDotRef.current) {
        gazeDotRef.current.style.opacity = "0";
      }
      setStatusMessage("Tracking paused locally. GazeCloudAPI is still running.");
    }
  }, []);

  const clearHeatmap = useCallback(() => {
    resetTrackingData();
    setStatusMessage(
      trackingStateRef.current.calibrated
        ? "Heatmap cleared. Tracking active."
        : "Heatmap cleared.",
    );
  }, [resetTrackingData]);

  const togglePreview = useCallback(() => {
    setIsPreviewVisible((currentValue) => !currentValue);
  }, []);

  const handleFrameLoad = useCallback(() => {
    attachFrameScrollTracking();
    renderHeatmap();
    if (!currentTargetUrl) {
      return;
    }

    const trackingState = trackingStateRef.current;
    if (trackingState.started && trackingState.calibrated && !trackingState.paused) {
      setStatusMessage(`Page loaded: ${currentTargetUrl}. Tracking active.`);
    } else if (trackingState.started && trackingState.paused) {
      setStatusMessage(`Page loaded: ${currentTargetUrl}. Tracking paused.`);
    } else if (trackingState.started) {
      setStatusMessage(`Page loaded: ${currentTargetUrl}. Finish calibration in the GazeCloudAPI overlay.`);
    } else {
      setStatusMessage(`Page loaded: ${currentTargetUrl}. Click "Start Tracking".`);
    }
  }, [attachFrameScrollTracking, currentTargetUrl, renderHeatmap]);

  const handleFrameError = useCallback(() => {
    setFrameHint("Target page could not be loaded by local proxy. Try another URL.");
    setStatusMessage("Failed to load page.");
  }, []);

  useEffect(() => {
    heatmapContextRef.current = heatmapCanvasRef.current?.getContext("2d") || null;
    coverageContextRef.current = coverageCanvasRef.current?.getContext("2d") || null;
    resizeHeatmapCanvas();
    drawCoverageMap();
    loadTargetUrl(initialTargetUrl);
    try {
      setReturnToAnalysisUrl(sessionStorage.getItem(ANALYSIS_RETURN_URL_STORAGE_KEY) || "");
    } catch (_) {
      setReturnToAnalysisUrl("");
    }
  }, [drawCoverageMap, initialTargetUrl, loadTargetUrl, resizeHeatmapCanvas]);

  useEffect(() => {
    document.body.classList.toggle("gaze-preview-hidden", !isPreviewVisible);
  }, [isPreviewVisible]);

  useEffect(() => {
    if (!isStarted) {
      return undefined;
    }
    const durationTimer = window.setInterval(() => {
      setDurationMilliseconds(currentDurationMs());
    }, 500);
    return () => window.clearInterval(durationTimer);
  }, [currentDurationMs, isStarted]);

  useEffect(() => {
    const handleResize = () => {
      resizeHeatmapCanvas();
      renderHeatmap();
      drawCoverageMap();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawCoverageMap, renderHeatmap, resizeHeatmapCanvas]);

  useEffect(() => {
    return () => {
      if (detachFrameScrollListenerRef.current) {
        detachFrameScrollListenerRef.current();
        detachFrameScrollListenerRef.current = null;
      }
      if (window.GazeCloudAPI && typeof window.GazeCloudAPI.StopEyeTracking === "function") {
        window.GazeCloudAPI.StopEyeTracking();
      }
    };
  }, []);

  return (
    <>
      <AppNav activePage="eye" />
      <main className="eye-page">
        <EyeEvidenceIntro />

        <div className="eye-workflow-layout">
          <div className="eye-workflow-column">
            <ReportLinkPanel
              relatedReportId={relatedReportId}
              sourceName={sourceName}
              onRelatedReportIdChange={setRelatedReportId}
              onSourceNameChange={setSourceName}
            />
            <TestPagePanel
              targetUrlInput={targetUrlInput}
              currentTargetUrl={currentTargetUrl}
              frameHint={frameHint}
              onTargetUrlInputChange={setTargetUrlInput}
              onLoadTargetUrl={handleLoadTargetUrl}
            />
            <RecordingControls
              isStarted={isStarted}
              isPaused={isPaused}
              isPreviewVisible={isPreviewVisible}
              canSave={canSave}
              isSaving={isSaving}
              onStartTracking={beginTracking}
              onTogglePause={togglePause}
              onClearHeatmap={clearHeatmap}
              onTogglePreview={togglePreview}
              onSaveSession={saveCurrentSession}
            />
            <EvidenceSummary
              statusMessage={statusMessage}
              coordinatesText={coordinatesText}
              sampleCount={sampleCount}
              coveragePercent={coveragePercent}
              durationText={durationText}
              lastSavedSessionId={lastSavedSessionId}
              coverageCanvasRef={coverageCanvasRef}
            />
            {returnToAnalysisUrl ? (
              <button
                className="eye-secondary-link"
                type="button"
                onClick={() => {
                  window.location.href = returnToAnalysisUrl;
                }}
              >
                Back to analysis
              </button>
            ) : null}
          </div>

          <div className="eye-recording-column" ref={viewportShellRef}>
            <TrackingViewport
              targetFrameSource={targetFrameSource}
              targetFrameRef={targetFrameRef}
              heatmapCanvasRef={heatmapCanvasRef}
              gazeDotRef={gazeDotRef}
              onFrameLoad={handleFrameLoad}
              onFrameError={handleFrameError}
            />
          </div>
        </div>
      </main>
    </>
  );
}
