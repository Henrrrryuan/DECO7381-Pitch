const viewportEl = document.getElementById("viewport");
const heatmapCanvas = document.getElementById("heatmapCanvas");
const coverageCanvas = document.getElementById("coverageCanvas");
const gazeDot = document.getElementById("gazeDot");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const clearBtn = document.getElementById("clearBtn");
const previewBtn = document.getElementById("previewBtn");
const saveBtn = document.getElementById("saveBtn");
const urlInput = document.getElementById("urlInput");
const loadUrlBtn = document.getElementById("loadUrlBtn");
const targetFrame = document.getElementById("targetFrame");
const frameHint = document.getElementById("frameHint");

const statusText = document.getElementById("statusText");
const coordsText = document.getElementById("coordsText");
const samplesText = document.getElementById("samplesText");
const coverageText = document.getElementById("coverageText");

const heatCtx = heatmapCanvas.getContext("2d");
const coverageCtx = coverageCanvas.getContext("2d");
const queryParams = new URLSearchParams(window.location.search);
const EYE_TARGET_URL_STORAGE_KEY = "cognilens.eye.target-url";

const state = {
  started: false,
  paused: false,
  previewVisible: false,
  calibrated: false,
  lastTrackerState: null,
  samples: 0,
  filteredPoint: null,
  lastRawPoint: null,
  lastSampleTime: 0,
  lastHeatSampleTime: 0,
  lastHeatPoint: null,
  gridCols: 24,
  gridRows: 14,
  cellCounts: [],
  visitedCellIds: new Set(),
  currentTargetUrl: "",
  relatedRunId: queryParams.get("run_id") || "",
  sourceName: queryParams.get("source_name") || "",
  sessionStartPerf: 0,
  sessionStartedAtIso: "",
  pausedDurationMs: 0,
  pausedAtPerf: 0,
  saving: false,
  lastSavedSessionId: ""
};

state.cellCounts = new Array(state.gridCols * state.gridRows).fill(0);
const HEAT_SAMPLE_INTERVAL_MS = 45;
const HEAT_MIN_DISTANCE_PX = 4;

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function setStatus(text) {
  statusText.textContent = text;
}

function setTrackingControlsEnabled(enabled) {
  pauseBtn.disabled = !enabled;
  clearBtn.disabled = !enabled;
  previewBtn.disabled = !enabled;
}

function updateSaveButtonState() {
  if (!saveBtn) {
    return;
  }
  const canSave = Boolean(state.currentTargetUrl) && state.samples > 0 && !state.saving;
  saveBtn.disabled = !canSave;
  saveBtn.textContent = state.saving ? "Saving..." : "Save Session";
}

function getErrorMessage(error) {
  if (!error) {
    return "Unknown error";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  try {
    return JSON.stringify(error);
  } catch (_) {
    return String(error);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeTargetUrl(rawInput) {
  const value = String(rawInput || "").trim();
  if (!value) {
    throw new Error("Please input a URL first.");
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
  } catch (_) {
    throw new Error("Invalid URL format.");
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
  } catch (_) {
    throw new Error("Invalid URL format.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http:// or https:// URLs are supported.");
  }

  return parsed.href;
}

function readPreferredTargetUrl() {
  const explicitTarget = (queryParams.get("prefill_url") || "").trim();
  if (explicitTarget) {
    return explicitTarget;
  }

  try {
    return (localStorage.getItem(EYE_TARGET_URL_STORAGE_KEY) || "").trim();
  } catch (_) {
    return "";
  }
}

function persistPreferredTargetUrl(url) {
  try {
    const value = String(url || "").trim();
    if (value) {
      localStorage.setItem(EYE_TARGET_URL_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(EYE_TARGET_URL_STORAGE_KEY);
    }
  } catch (_) {
    // Ignore localStorage failures and keep the current in-memory target URL.
  }
}

function setFrameHint(text) {
  if (frameHint) {
    frameHint.textContent = text;
  }
}

function toProxyUrl(targetUrl) {
  return `/eye/proxy?url=${encodeURIComponent(targetUrl)}`;
}

function loadTargetUrl(rawInput) {
  if (!targetFrame) {
    return;
  }

  try {
    const normalizedUrl = normalizeTargetUrl(rawInput);
    state.currentTargetUrl = normalizedUrl;
    urlInput.value = normalizedUrl;
    persistPreferredTargetUrl(normalizedUrl);
    targetFrame.src = toProxyUrl(normalizedUrl);
    setFrameHint(
      "Page is loaded through local proxy mode. Some highly dynamic or login-heavy sites may still behave differently."
    );
    resetTrackingData();
    setStatus(`Loading page: ${normalizedUrl}`);
  } catch (error) {
    setStatus(getErrorMessage(error));
  }
}

function getViewportRect() {
  return viewportEl.getBoundingClientRect();
}

function currentCoveragePercent() {
  if (!state.gridCols || !state.gridRows) {
    return 0;
  }
  return Number(
    (
      (state.visitedCellIds.size / (state.gridCols * state.gridRows)) *
      100
    ).toFixed(1)
  );
}

function currentDurationMs() {
  if (!state.sessionStartPerf) {
    return 0;
  }
  const now = state.paused && state.pausedAtPerf ? state.pausedAtPerf : performance.now();
  return Math.max(0, Math.round(now - state.sessionStartPerf - state.pausedDurationMs));
}

function getFrameDocument() {
  if (!targetFrame) {
    return null;
  }
  try {
    return targetFrame.contentDocument || targetFrame.contentWindow?.document || null;
  } catch (_) {
    return null;
  }
}

function captureHtmlSnapshot() {
  const doc = getFrameDocument();
  return doc?.documentElement?.outerHTML || "";
}

function deriveSessionSourceName() {
  const explicit = String(state.sourceName || "").trim();
  if (explicit) {
    return explicit;
  }
  if (state.currentTargetUrl) {
    try {
      const parsed = new URL(state.currentTargetUrl);
      return parsed.hostname || state.currentTargetUrl;
    } catch (_) {
      return state.currentTargetUrl;
    }
  }
  return "Eye Tracking Session";
}

function buildEyeSessionPayload() {
  return {
    run_id: state.relatedRunId || null,
    source_name: deriveSessionSourceName(),
    target_url: state.currentTargetUrl || "",
    html_snapshot: captureHtmlSnapshot(),
    sample_count: state.samples,
    duration_ms: currentDurationMs(),
    coverage_percent: currentCoveragePercent(),
    grid_cols: state.gridCols,
    grid_rows: state.gridRows,
    cell_counts: [...state.cellCounts],
    summary: {
      saved_at: new Date().toISOString(),
      session_started_at: state.sessionStartedAtIso || null,
      visited_cells: state.visitedCellIds.size,
      last_saved_session_id: state.lastSavedSessionId || null
    }
  };
}

async function saveCurrentSession() {
  if (state.saving) {
    return;
  }
  if (!state.currentTargetUrl || state.samples <= 0) {
    setStatus("Track a page first before saving an eye session.");
    return;
  }

  state.saving = true;
  updateSaveButtonState();

  try {
    const response = await fetch("/eye/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildEyeSessionPayload())
    });

    if (!response.ok) {
      let detail = `Request failed with status ${response.status}`;
      try {
        const payload = await response.json();
        if (payload?.detail) {
          detail = payload.detail;
        }
      } catch (_) {
        // Keep the fallback status text.
      }
      throw new Error(detail);
    }

    const payload = await response.json();
    const sessionId = payload?.session?.session_id || "";
    state.lastSavedSessionId = sessionId;
    setStatus(
      sessionId
        ? `Eye session saved to history (${sessionId.slice(0, 8)}...).`
        : "Eye session saved to history."
    );
  } catch (error) {
    setStatus(`Failed to save eye session: ${getErrorMessage(error)}`);
  } finally {
    state.saving = false;
    updateSaveButtonState();
  }
}

function resizeHeatmapCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = getViewportRect();
  heatmapCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
  heatmapCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
  heatCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resetTrackingData() {
  const rect = getViewportRect();
  heatCtx.clearRect(0, 0, rect.width, rect.height);
  state.samples = 0;
  state.filteredPoint = null;
  state.lastRawPoint = null;
  state.lastSampleTime = 0;
  state.lastHeatSampleTime = 0;
  state.lastHeatPoint = null;
  state.pausedDurationMs = 0;
  state.pausedAtPerf = 0;
  state.sessionStartPerf = state.started ? performance.now() : 0;
  state.sessionStartedAtIso = state.started ? new Date().toISOString() : "";
  state.lastSavedSessionId = "";
  state.cellCounts.fill(0);
  state.visitedCellIds.clear();
  samplesText.textContent = "0";
  coverageText.textContent = "0%";
  coordsText.textContent = "x: -, y: -";
  gazeDot.style.opacity = "0";
  drawCoverageMap();
  updateSaveButtonState();
}

function drawHeatPoint(x, y) {
  const radius = 72;
  const gradient = heatCtx.createRadialGradient(x, y, 2, x, y, radius);
  gradient.addColorStop(0, "rgba(255, 80, 80, 0.22)");
  gradient.addColorStop(0.5, "rgba(255, 150, 80, 0.10)");
  gradient.addColorStop(1, "rgba(255, 180, 80, 0)");

  heatCtx.fillStyle = gradient;
  heatCtx.beginPath();
  heatCtx.arc(x, y, radius, 0, Math.PI * 2);
  heatCtx.fill();
}

function drawCoverageMap() {
  const width = coverageCanvas.width;
  const height = coverageCanvas.height;
  coverageCtx.clearRect(0, 0, width, height);
  coverageCtx.fillStyle = "#020617";
  coverageCtx.fillRect(0, 0, width, height);

  const cellWidth = width / state.gridCols;
  const cellHeight = height / state.gridRows;

  for (let row = 0; row < state.gridRows; row += 1) {
    for (let col = 0; col < state.gridCols; col += 1) {
      const index = row * state.gridCols + col;
      const count = state.cellCounts[index];
      if (!count) {
        continue;
      }
      const strength = clamp(count / 20, 0.08, 1);
      const red = Math.round(255);
      const green = Math.round(210 - strength * 110);
      const blue = Math.round(80 - strength * 30);
      coverageCtx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${strength})`;
      coverageCtx.fillRect(
        col * cellWidth,
        row * cellHeight,
        cellWidth,
        cellHeight
      );
    }
  }

  coverageCtx.strokeStyle = "rgba(148, 163, 184, 0.18)";
  coverageCtx.lineWidth = 1;
  for (let col = 1; col < state.gridCols; col += 1) {
    const x = Math.round(col * cellWidth) + 0.5;
    coverageCtx.beginPath();
    coverageCtx.moveTo(x, 0);
    coverageCtx.lineTo(x, height);
    coverageCtx.stroke();
  }
  for (let row = 1; row < state.gridRows; row += 1) {
    const y = Math.round(row * cellHeight) + 0.5;
    coverageCtx.beginPath();
    coverageCtx.moveTo(0, y);
    coverageCtx.lineTo(width, y);
    coverageCtx.stroke();
  }
}

function updateCoverage(x, y, width, height) {
  const col = clamp(Math.floor((x / width) * state.gridCols), 0, state.gridCols - 1);
  const row = clamp(Math.floor((y / height) * state.gridRows), 0, state.gridRows - 1);
  const index = row * state.gridCols + col;
  state.cellCounts[index] += 1;
  state.visitedCellIds.add(index);

  const coveragePercent = (
    currentCoveragePercent()
  ).toFixed(1);
  coverageText.textContent = `${coveragePercent}%`;
}

function setPreviewVisibility(visible) {
  state.previewVisible = Boolean(visible);
  document.body.classList.toggle("gaze-preview-hidden", !state.previewVisible);
  previewBtn.textContent = state.previewVisible
    ? "Hide Camera Preview"
    : "Show Camera Preview";
}

function handleTrackerStop(message) {
  state.started = false;
  state.paused = false;
  state.calibrated = false;
  state.lastTrackerState = null;
  pauseBtn.textContent = "Pause";
  setTrackingControlsEnabled(false);
  setPreviewVisibility(false);
  gazeDot.style.opacity = "0";
  setStatus(message);
  updateSaveButtonState();
}

function updateTrackerState(gazeState) {
  if (state.lastTrackerState === gazeState || state.paused) {
    return;
  }

  state.lastTrackerState = gazeState;

  if (gazeState === 0) {
    setStatus("Tracking active. Move your eyes naturally.");
    return;
  }

  if (gazeState === 1) {
    setStatus("Calibration in progress. Follow the GazeCloudAPI overlay.");
    return;
  }

  if (gazeState === -1) {
    gazeDot.style.opacity = "0";
    setStatus(
      state.calibrated
        ? "Face tracking lost. Keep your face centered in the camera."
        : "Waiting for face detection..."
    );
  }
}

function getGazeClientPoint(data) {
  if (Number.isFinite(data.docX) && Number.isFinite(data.docY)) {
    return {
      x: data.docX - window.scrollX,
      y: data.docY - window.scrollY
    };
  }

  if (Number.isFinite(data.x) && Number.isFinite(data.y)) {
    return { x: data.x, y: data.y };
  }

  return null;
}

function handleGaze(data) {
  if (!data || !state.started || state.paused) {
    return;
  }

  if (typeof data.state === "number") {
    if (data.state === 0 && !state.calibrated) {
      state.calibrated = true;
    }
    updateTrackerState(data.state);
    if (data.state !== 0 || !state.calibrated) {
      return;
    }
  }

  const rect = getViewportRect();
  const point = getGazeClientPoint(data);
  if (!point) {
    return;
  }

  if (
    point.x < rect.left ||
    point.x > rect.right ||
    point.y < rect.top ||
    point.y > rect.bottom
  ) {
    gazeDot.style.opacity = "0";
    return;
  }

  const rawX = point.x - rect.left;
  const rawY = point.y - rect.top;
  const now = performance.now();
  const rawPoint = { x: rawX, y: rawY };

  if (!state.filteredPoint) {
    state.filteredPoint = rawPoint;
    state.lastRawPoint = rawPoint;
    state.lastSampleTime = now;
  } else {
    const dt = Math.max((now - state.lastSampleTime) / 1000, 1 / 240);
    const rawMotion = distance(rawPoint, state.lastRawPoint);
    const speed = rawMotion / dt;
    const gapToFiltered = distance(rawPoint, state.filteredPoint);

    const alpha = speed > 700 ? 0.62 : speed > 260 ? 0.45 : 0.26;
    const deadZone = speed < 120 ? 5.5 : 2.5;

    if (gapToFiltered >= deadZone) {
      state.filteredPoint = {
        x: state.filteredPoint.x + (rawX - state.filteredPoint.x) * alpha,
        y: state.filteredPoint.y + (rawY - state.filteredPoint.y) * alpha
      };
    }

    state.lastRawPoint = rawPoint;
    state.lastSampleTime = now;
  }

  const x = state.filteredPoint.x;
  const y = state.filteredPoint.y;

  gazeDot.style.opacity = "1";
  gazeDot.style.left = `${x}px`;
  gazeDot.style.top = `${y}px`;

  const needHeatSampleByTime = now - state.lastHeatSampleTime >= HEAT_SAMPLE_INTERVAL_MS;
  const needHeatSampleByMove =
    !state.lastHeatPoint ||
    distance(state.lastHeatPoint, { x, y }) >= HEAT_MIN_DISTANCE_PX;

  if (needHeatSampleByTime && needHeatSampleByMove) {
    drawHeatPoint(x, y);
    updateCoverage(x, y, rect.width, rect.height);
    drawCoverageMap();
    state.lastHeatSampleTime = now;
    state.lastHeatPoint = { x, y };
  }

  state.samples += 1;
  samplesText.textContent = String(state.samples);
  coordsText.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
}

function beginTracking() {
  if (!window.GazeCloudAPI) {
    throw new Error("GazeCloudAPI script did not load.");
  }

  window.GazeCloudAPI.UseClickRecalibration = false;
  window.GazeCloudAPI.OnResult = handleGaze;
  window.GazeCloudAPI.OnCalibrationComplete = () => {
    state.calibrated = true;
    state.lastTrackerState = null;
    if (!state.paused) {
      setStatus("Calibration complete. Tracking active.");
    }
  };
  window.GazeCloudAPI.OnCamDenied = () => {
    handleTrackerStop("Camera access denied.");
  };
  window.GazeCloudAPI.OnError = (message) => {
    handleTrackerStop(`GazeCloudAPI error: ${getErrorMessage(message)}`);
  };
  window.GazeCloudAPI.OnStopGazeFlow = () => {
    if (state.started) {
      handleTrackerStop("Tracking stopped.");
    }
  };

  resetTrackingData();
  state.started = true;
  state.paused = false;
  state.calibrated = false;
  state.lastTrackerState = null;
  state.sessionStartPerf = performance.now();
  state.sessionStartedAtIso = new Date().toISOString();
  state.pausedDurationMs = 0;
  state.pausedAtPerf = 0;
  state.lastSavedSessionId = "";
  setTrackingControlsEnabled(true);
  pauseBtn.textContent = "Pause";
  setPreviewVisibility(true);
  setStatus("Starting GazeCloudAPI. Allow camera access and follow the calibration overlay.");
  updateSaveButtonState();
  window.GazeCloudAPI.StartEyeTracking();
}

startBtn.addEventListener("click", () => {
  if (state.started) {
    setStatus("Tracking already running.");
    return;
  }
  try {
    beginTracking();
  } catch (error) {
    handleTrackerStop(`Failed to start: ${getErrorMessage(error)}`);
    // eslint-disable-next-line no-console
    console.error(error);
  }
});

pauseBtn.addEventListener("click", () => {
  if (!state.started) {
    return;
  }
  if (state.paused) {
    state.paused = false;
    if (state.pausedAtPerf) {
      state.pausedDurationMs += performance.now() - state.pausedAtPerf;
      state.pausedAtPerf = 0;
    }
    state.lastTrackerState = null;
    pauseBtn.textContent = "Pause";
    setStatus(
      state.calibrated
        ? "Tracking resumed."
        : "Calibration in progress. Follow the GazeCloudAPI overlay."
    );
  } else {
    state.paused = true;
    state.pausedAtPerf = performance.now();
    pauseBtn.textContent = "Resume";
    gazeDot.style.opacity = "0";
    setStatus("Tracking paused locally. GazeCloudAPI is still running.");
  }
  updateSaveButtonState();
});

clearBtn.addEventListener("click", () => {
  resetTrackingData();
  setStatus(state.calibrated ? "Heatmap cleared. Tracking active." : "Heatmap cleared.");
});

previewBtn.addEventListener("click", () => {
  setPreviewVisibility(!state.previewVisible);
});

saveBtn?.addEventListener("click", () => {
  saveCurrentSession().catch((error) => {
    setStatus(`Failed to save eye session: ${getErrorMessage(error)}`);
  });
});

loadUrlBtn.addEventListener("click", () => {
  loadTargetUrl(urlInput.value);
});

urlInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  loadTargetUrl(urlInput.value);
});

if (targetFrame) {
  targetFrame.addEventListener("load", () => {
    if (!state.currentTargetUrl) {
      return;
    }
    if (state.started && state.calibrated && !state.paused) {
      setStatus(`Page loaded: ${state.currentTargetUrl}. Tracking active.`);
    } else if (state.started && state.paused) {
      setStatus(`Page loaded: ${state.currentTargetUrl}. Tracking paused.`);
    } else if (state.started) {
      setStatus(
        `Page loaded: ${state.currentTargetUrl}. Finish calibration in the GazeCloudAPI overlay.`
      );
    } else {
      setStatus(`Page loaded: ${state.currentTargetUrl}. Click "Start Tracking".`);
    }
  });

  targetFrame.addEventListener("error", () => {
    setFrameHint(
      "Target page could not be loaded by local proxy. Try another URL."
    );
    setStatus("Failed to load page.");
  });
}

window.addEventListener("resize", () => {
  resizeHeatmapCanvas();
  drawCoverageMap();
});

window.addEventListener("beforeunload", () => {
  if (window.GazeCloudAPI && typeof window.GazeCloudAPI.StopEyeTracking === "function") {
    window.GazeCloudAPI.StopEyeTracking();
  }
});

resizeHeatmapCanvas();
drawCoverageMap();
setPreviewVisibility(false);
setTrackingControlsEnabled(false);

const preferredTargetUrl = readPreferredTargetUrl();
if (urlInput && preferredTargetUrl) {
  urlInput.value = preferredTargetUrl;
}

if (urlInput && urlInput.value) {
  loadTargetUrl(urlInput.value);
}
