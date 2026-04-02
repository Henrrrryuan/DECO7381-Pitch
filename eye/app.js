const viewportEl = document.getElementById("viewport");
const heatmapCanvas = document.getElementById("heatmapCanvas");
const coverageCanvas = document.getElementById("coverageCanvas");
const gazeDot = document.getElementById("gazeDot");
const calibrationLayer = document.getElementById("calibrationLayer");
const calibrationPoints = Array.from(document.querySelectorAll(".cal-point"));

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const clearBtn = document.getElementById("clearBtn");
const previewBtn = document.getElementById("previewBtn");

const statusText = document.getElementById("statusText");
const coordsText = document.getElementById("coordsText");
const samplesText = document.getElementById("samplesText");
const coverageText = document.getElementById("coverageText");

const heatCtx = heatmapCanvas.getContext("2d");
const coverageCtx = coverageCanvas.getContext("2d");

const state = {
  started: false,
  paused: false,
  previewVisible: false,
  calibrated: false,
  calibrationTargetClicks: 5,
  calibrationFinishedPoints: 0,
  samples: 0,
  filteredPoint: null,
  lastRawPoint: null,
  lastSampleTime: 0,
  lastHeatSampleTime: 0,
  lastHeatPoint: null,
  gridCols: 24,
  gridRows: 14,
  cellCounts: [],
  visitedCellIds: new Set()
};

state.cellCounts = new Array(state.gridCols * state.gridRows).fill(0);
const FACE_MESH_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/";
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

function getViewportRect() {
  return viewportEl.getBoundingClientRect();
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
  state.cellCounts.fill(0);
  state.visitedCellIds.clear();
  samplesText.textContent = "0";
  coverageText.textContent = "0%";
  coordsText.textContent = "x: -, y: -";
  drawCoverageMap();
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
    (state.visitedCellIds.size / (state.gridCols * state.gridRows)) *
    100
  ).toFixed(1);
  coverageText.textContent = `${coveragePercent}%`;
}

function handleGaze(data) {
  if (!data || !state.started || state.paused || !state.calibrated) {
    return;
  }

  const rect = getViewportRect();
  const rawX = clamp(data.x - rect.left, 0, rect.width);
  const rawY = clamp(data.y - rect.top, 0, rect.height);
  if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) {
    return;
  }

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

function updatePreviewVisibility() {
  if (!window.webgazer) {
    return;
  }
  if (typeof window.webgazer.showVideoPreview === "function") {
    window.webgazer.showVideoPreview(state.previewVisible);
  }
  const container = document.getElementById("webgazerVideoContainer");
  if (container) {
    container.style.display = state.previewVisible ? "block" : "none";
  }
  previewBtn.textContent = state.previewVisible
    ? "Hide Camera Preview"
    : "Show Camera Preview";
}

function resetCalibrationUi() {
  calibrationPoints.forEach((point) => {
    point.disabled = false;
    point.dataset.count = "0";
    point.textContent = "";
  });
  state.calibrationFinishedPoints = 0;
  state.calibrated = false;
  calibrationLayer.classList.remove("hidden");
  setStatus("Calibration active. Click each dot 5 times.");
}

async function beginTracking() {
  if (!window.webgazer) {
    throw new Error("webgazer script did not load.");
  }

  if (window.webgazer.params) {
    // Avoid missing local mediapipe files by forcing a hosted solution path.
    window.webgazer.params.faceMeshSolutionPath = FACE_MESH_CDN;
  }

  if (typeof window.webgazer.setRegression === "function") {
    window.webgazer.setRegression("ridge");
  }
  if (typeof window.webgazer.saveDataAcrossSessions === "function") {
    window.webgazer.saveDataAcrossSessions(false);
  }
  if (typeof window.webgazer.applyKalmanFilter === "function") {
    window.webgazer.applyKalmanFilter(true);
  }
  window.webgazer.setGazeListener((data) => {
    handleGaze(data);
  });

  await window.webgazer.begin();
  state.started = true;
  state.paused = false;
  pauseBtn.textContent = "Pause";
  pauseBtn.disabled = false;
  clearBtn.disabled = false;
  previewBtn.disabled = false;

  if (typeof window.webgazer.showPredictionPoints === "function") {
    window.webgazer.showPredictionPoints(false);
  }
  if (typeof window.webgazer.showFaceOverlay === "function") {
    window.webgazer.showFaceOverlay(false);
  }
  if (typeof window.webgazer.showFaceFeedbackBox === "function") {
    window.webgazer.showFaceFeedbackBox(false);
  }
  updatePreviewVisibility();
}

function onCalibrationPointClick(event) {
  if (!state.started) {
    return;
  }

  const btn = event.currentTarget;
  if (btn.disabled) {
    return;
  }

  const nextCount = Number(btn.dataset.count || "0") + 1;
  btn.dataset.count = String(nextCount);
  btn.textContent = String(nextCount);

  const rect = getViewportRect();
  const x = rect.left + rect.width * Number(btn.dataset.x);
  const y = rect.top + rect.height * Number(btn.dataset.y);
  if (typeof window.webgazer.recordScreenPosition === "function") {
    window.webgazer.recordScreenPosition(x, y, "click");
  }

  btn.style.opacity = String(clamp(nextCount / state.calibrationTargetClicks, 0.3, 1));

  if (nextCount >= state.calibrationTargetClicks) {
    btn.disabled = true;
    state.calibrationFinishedPoints += 1;
  }

  if (state.calibrationFinishedPoints === calibrationPoints.length) {
    state.calibrated = true;
    calibrationLayer.classList.add("hidden");
    setStatus("Tracking active. Move your eyes naturally.");
  }
}

startBtn.addEventListener("click", async () => {
  if (state.started) {
    setStatus("Tracking already running.");
    return;
  }
  try {
    setStatus("Requesting camera permission...");
    await beginTracking();
    resetTrackingData();
    resetCalibrationUi();
  } catch (error) {
    if (window.webgazer && typeof window.webgazer.end === "function") {
      try {
        window.webgazer.end();
      } catch (_) {
        // swallow cleanup errors
      }
    }
    const message = getErrorMessage(error);
    setStatus(`Failed to start: ${message}`);
    // eslint-disable-next-line no-console
    console.error(error);
  }
});

pauseBtn.addEventListener("click", () => {
  if (!state.started) {
    return;
  }
  if (state.paused) {
    if (typeof window.webgazer.resume === "function") {
      window.webgazer.resume();
    }
    state.paused = false;
    pauseBtn.textContent = "Pause";
    setStatus("Tracking active.");
  } else {
    if (typeof window.webgazer.pause === "function") {
      window.webgazer.pause();
    }
    state.paused = true;
    pauseBtn.textContent = "Resume";
    setStatus("Tracking paused.");
  }
});

clearBtn.addEventListener("click", () => {
  resetTrackingData();
  setStatus(state.calibrated ? "Heatmap cleared. Tracking active." : "Heatmap cleared.");
});

previewBtn.addEventListener("click", () => {
  state.previewVisible = !state.previewVisible;
  updatePreviewVisibility();
});

calibrationPoints.forEach((point) => {
  point.addEventListener("click", onCalibrationPointClick);
});

window.addEventListener("resize", () => {
  resizeHeatmapCanvas();
  drawCoverageMap();
});

window.addEventListener("beforeunload", () => {
  if (window.webgazer && typeof window.webgazer.end === "function") {
    window.webgazer.end();
  }
});

resizeHeatmapCanvas();
drawCoverageMap();
