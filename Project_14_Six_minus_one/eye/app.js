const viewportEl = document.getElementById("viewport");
const heatmapCanvas = document.getElementById("heatmapCanvas");
const coverageCanvas = document.getElementById("coverageCanvas");
const gazeDot = document.getElementById("gazeDot");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const clearBtn = document.getElementById("clearBtn");
const loadHtmlBtn = document.getElementById("loadHtmlBtn");
const loadHtmlInput = document.getElementById("loadHtmlInput");
const saveBtn = document.getElementById("saveBtn");
const aboutEyeTrackingBtn = document.getElementById("aboutEyeTrackingBtn");
const urlInput = document.getElementById("urlInput");
const loadUrlBtn = document.getElementById("loadUrlBtn");
const targetFrame = document.getElementById("targetFrame");
const frameHint = document.getElementById("frameHint");
const eyeIntroModal = document.getElementById("eyeIntroModal");
const eyeIntroContinueBtn = document.getElementById("eyeIntroContinueBtn");

const statusText = document.getElementById("statusText");
const coordsText = document.getElementById("coordsText");
const samplesText = document.getElementById("samplesText");
const coverageText = document.getElementById("coverageText");

const heatCtx = heatmapCanvas.getContext("2d");
let coverageCtx = coverageCanvas.getContext("2d");
const queryParams = new URLSearchParams(window.location.search);
const EYE_TARGET_URL_STORAGE_KEY = "cognilens.eye.target-url";
const ANALYSIS_RETURN_URL_STORAGE_KEY = "cognilens.return.analysis-url";
/** Same key as `dashboardApp.js` — latest analysis run to attach behavioral evidence. */
const EYE_RELATED_CONTEXT_STORAGE_KEY = "cognilens.eye.related-context";

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
  heatSamples: [],
  currentTargetUrl: "",
  relatedRunId: "",
  sourceName: queryParams.get("source_name") || "",
  sessionStartPerf: 0,
  sessionStartedAtIso: "",
  pausedDurationMs: 0,
  pausedAtPerf: 0,
  saving: false,
  savedThisRun: false,
  lastSavedSessionId: ""
};

const ATTENTION_BUCKETS = [
  { key: "main_text", label: "Main text" },
  { key: "headings", label: "Headings" },
  { key: "interactive", label: "Interactive elements" },
  { key: "navigation", label: "Navigation" },
  { key: "media", label: "Images/media" },
  { key: "other", label: "Other" }
];
const MEANINGFUL_ATTENTION_BUCKETS = new Set([
  "headings",
  "interactive",
  "main_text",
  "navigation",
  "media"
]);
const ATTENTION_BUCKET_PRIORITY = {
  interactive: 5,
  headings: 4,
  navigation: 3,
  main_text: 2,
  media: 1,
  other: 0
};
const NEAR_HIT_RADIUS_BY_BUCKET = {
  headings: 24,
  interactive: 32,
  main_text: 24,
  navigation: 24,
  media: 20
};
const NEAR_HIT_WEIGHT = 0.5;
const HIT_DETECTION_METHOD = "dom_element_with_near_hit_fallback";
const ATTENTION_GROUP_SELECTORS = {
  headings: "h1, h2, h3, h4, h5, h6",
  interactive: [
    "button",
    "a[href]",
    "input",
    "select",
    "textarea",
    "[role='button']",
    "[role='link']",
    "[role='menuitem']",
    "[role='tab']",
    "[role='switch']",
    "[role='checkbox']",
    "[role='radio']",
    "[onclick]"
  ].join(", "),
  main_text: [
    "p",
    "article",
    "section",
    "[role='article']",
    "[data-track-region*='text']",
    "[data-track-region*='content']"
  ].join(", "),
  navigation: [
    "nav",
    "[role='navigation']",
    "[data-track-region*='nav']",
    "[class*='nav']",
    "[id*='nav']"
  ].join(", "),
  media: "img, video, canvas, svg, [role='img']"
};

function createAttentionSummaryState() {
  const buckets = {};
  for (const bucket of ATTENTION_BUCKETS) {
    buckets[bucket.key] = {
      key: bucket.key,
      label: bucket.label,
      hit_count: 0,
      exact_hit_count: 0,
      near_hit_count: 0,
      weighted_hit_score: 0,
      dwell_ms: 0,
      weighted_dwell_ms: 0,
      first_fixation_ms: null
    };
  }
  return {
    total_hit_count: 0,
    total_near_hit_count: 0,
    total_weighted_hit_score: 0,
    total_dwell_ms: 0,
    total_weighted_dwell_ms: 0,
    buckets
  };
}

function persistEyeLocalContext(runId, sourceName) {
  const rid = (runId || "").trim();
  if (!rid) {
    return;
  }
  try {
    localStorage.setItem(
      EYE_RELATED_CONTEXT_STORAGE_KEY,
      JSON.stringify({
        run_id: rid,
        source_name: sourceName || "",
        savedAt: Date.now()
      })
    );
  } catch (_) {
    // Ignore quota / private mode.
  }
}

function updateLinkedRunIndicator() {
  const row = document.getElementById("linkedRunRow");
  const text = document.getElementById("linkedRunText");
  if (!row || !text) {
    return;
  }
  const rid = (state.relatedRunId || "").trim();
  if (!rid) {
    row.hidden = true;
    text.textContent = "—";
    text.removeAttribute("title");
    return;
  }
  row.hidden = false;
  const short = rid.length > 14 ? `${rid.slice(0, 10)}…` : rid;
  text.textContent = short;
  text.title = rid;
}

function refreshRelatedRunFromStorage() {
  const qs = new URLSearchParams(window.location.search);
  const fromUrl = (qs.get("run_id") || "").trim();
  if (fromUrl) {
    state.relatedRunId = fromUrl;
    const fromUrlSource = (qs.get("source_name") || "").trim();
    if (fromUrlSource) {
      state.sourceName = fromUrlSource;
    }
    persistEyeLocalContext(state.relatedRunId, state.sourceName);
    updateLinkedRunIndicator();
    return;
  }
  try {
    const raw = localStorage.getItem(EYE_RELATED_CONTEXT_STORAGE_KEY);
    if (!raw) {
      updateLinkedRunIndicator();
      return;
    }
    const parsed = JSON.parse(raw);
    const rid = (parsed.run_id || "").trim();
    if (rid) {
      state.relatedRunId = rid;
      if (!String(state.sourceName || "").trim() && parsed.source_name) {
        state.sourceName = String(parsed.source_name);
      }
    }
  } catch (_) {
    // Ignore invalid JSON.
  }
  updateLinkedRunIndicator();
}

refreshRelatedRunFromStorage();

let detachFrameScrollListener = null;
let detachCoverageResizeObserver = null;

/** Visited Map is always this bitmap size; full-page grid pans inside when the iframe scrolls. */
const COVERAGE_VIEW_W = 300;
const COVERAGE_VIEW_H = 180;

function ensureCoverageCanvasFixedSize() {
  if (!coverageCanvas) {
    return;
  }
  if (coverageCanvas.width !== COVERAGE_VIEW_W || coverageCanvas.height !== COVERAGE_VIEW_H) {
    coverageCanvas.width = COVERAGE_VIEW_W;
    coverageCanvas.height = COVERAGE_VIEW_H;
    coverageCtx = coverageCanvas.getContext("2d");
  }
}

function getCoveragePanLayout() {
  const scroll = getFrameScrollOffsets();
  const { visW, visH, docW, docH } = getFrameVisibleDocSize();
  const vw = COVERAGE_VIEW_W;
  const vh = COVERAGE_VIEW_H;

  if (!docW || !docH) {
    return {
      mapW: vw,
      mapH: vh,
      offsetX: 0,
      offsetY: 0,
      visW: 1,
      visH: 1,
      docW: 1,
      docH: 1,
      scrollX: 0,
      scrollY: 0
    };
  }

  const scaleW = vw / docW;
  const scaleH = vh / docH;
  let mapW;
  let mapH;
  if (scaleW * docH >= vh) {
    mapW = vw;
    mapH = scaleW * docH;
  } else {
    mapH = vh;
    mapW = scaleH * docW;
  }

  mapW = Math.max(vw, Math.round(mapW));
  mapH = Math.max(vh, Math.round(mapH));

  const maxScrollX = Math.max(0, docW - visW);
  const maxScrollY = Math.max(0, docH - visH);
  const maxPanX = Math.max(0, mapW - vw);
  const maxPanY = Math.max(0, mapH - vh);

  const offsetX = maxScrollX > 0 ? (scroll.x / maxScrollX) * maxPanX : 0;
  const offsetY = maxScrollY > 0 ? (scroll.y / maxScrollY) * maxPanY : 0;

  return {
    mapW,
    mapH,
    offsetX,
    offsetY,
    visW,
    visH,
    docW,
    docH,
    scrollX: scroll.x,
    scrollY: scroll.y
  };
}

function attachCoverageDocumentResizeTracking() {
  if (detachCoverageResizeObserver) {
    detachCoverageResizeObserver();
    detachCoverageResizeObserver = null;
  }

  const doc = getFrameDocument();
  const root = doc?.documentElement;
  if (!root) {
    ensureCoverageCanvasFixedSize();
    drawCoverageMap();
    return;
  }

  let rafId = 0;
  const schedule = () => {
    if (rafId) {
      return;
    }
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      drawCoverageMap();
    });
  };

  let observer = null;
  try {
    observer = new ResizeObserver(schedule);
    observer.observe(root);
  } catch (_) {
    schedule();
  }

  detachCoverageResizeObserver = () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };
}

state.cellCounts = new Array(state.gridCols * state.gridRows).fill(0);
state.attentionSummary = createAttentionSummaryState();
const HEAT_SAMPLE_INTERVAL_MS = 45;
const HEAT_MIN_DISTANCE_PX = 4;
const TRACKING_START_DELAY_MS = 1200;
const INTRO_PUPIL_MAX_OFFSET = 5.5;

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function setStatus(text) {
  statusText.textContent = text;
}

function getIntroPupils() {
  return Array.from(document.querySelectorAll(".eye-intro-pupil"));
}

function resetIntroPupils() {
  getIntroPupils().forEach((pupil) => {
    pupil.style.transform = "translate3d(0, 0, 0)";
  });
}

function updateIntroPupils(clientX, clientY) {
  if (!eyeIntroModal || eyeIntroModal.hidden) {
    return;
  }
  getIntroPupils().forEach((pupil) => {
    const eye = pupil.parentElement;
    if (!eye) {
      return;
    }
    const rect = eye.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const angle = Math.atan2(dy, dx);
    const distancePx = Math.min(INTRO_PUPIL_MAX_OFFSET, Math.hypot(dx, dy) * 0.09);
    const x = Math.cos(angle) * distancePx;
    const y = Math.sin(angle) * distancePx;
    pupil.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  });
}

function showEyeIntroModal() {
  if (!eyeIntroModal) {
    return;
  }
  eyeIntroModal.hidden = false;
  resetIntroPupils();
}

function hideEyeIntroModal() {
  if (!eyeIntroModal) {
    return;
  }
  eyeIntroModal.hidden = true;
  resetIntroPupils();
}

function setTrackingControlsEnabled(enabled) {
  pauseBtn.disabled = !enabled;
  clearBtn.disabled = !enabled;
}

function updateSaveButtonState() {
  if (!saveBtn) {
    return;
  }
  const hasRun = Boolean((state.relatedRunId || "").trim());
  const canSave = (
    hasRun
    && Boolean(state.currentTargetUrl)
    && state.samples > 0
    && !state.saving
    && !state.savedThisRun
  );
  saveBtn.disabled = !canSave;
  if (state.saving) {
    saveBtn.textContent = "Saving...";
    return;
  }
  saveBtn.textContent = state.savedThisRun ? "Saved" : "Save Session";
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

function setFrameHint(text) {
  if (frameHint) {
    const message = String(text || "").trim();
    frameHint.textContent = message;
    frameHint.hidden = !message;
  }
}

function toProxyUrl(targetUrl) {
  return `/eye/proxy?url=${encodeURIComponent(targetUrl)}`;
}

function detachFrameListeners() {
  if (detachCoverageResizeObserver) {
    detachCoverageResizeObserver();
    detachCoverageResizeObserver = null;
  }
  if (detachFrameScrollListener) {
    detachFrameScrollListener();
    detachFrameScrollListener = null;
  }
}

function isTempHtmlServicePath(urlString) {
  try {
    const u = new URL(urlString, window.location.origin);
    return u.pathname.startsWith("/eye/temp-html/");
  } catch (_) {
    return false;
  }
}

function loadTempHtmlPreview(relativePath, uploadLabel) {
  if (!targetFrame) {
    return;
  }
  const path = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  const absolutePersistUrl = new URL(path, window.location.origin).href;
  detachFrameListeners();
  state.currentTargetUrl = absolutePersistUrl;
  urlInput.value = absolutePersistUrl;
  persistPreferredTargetUrl(absolutePersistUrl);
  targetFrame.src = `${path}?t=${Date.now()}`;
  setFrameHint("");
  resetTrackingData();
  setStatus(uploadLabel ? `Uploaded ${uploadLabel}. Loading…` : "Loading temporary HTML…");
}

function loadTargetUrl(rawInput) {
  if (!targetFrame) {
    return;
  }

  try {
    detachFrameListeners();
    const normalizedUrl = normalizeTargetUrl(rawInput);
    state.currentTargetUrl = normalizedUrl;
    urlInput.value = normalizedUrl;
    persistPreferredTargetUrl(normalizedUrl);
    if (isTempHtmlServicePath(normalizedUrl)) {
      const u = new URL(normalizedUrl);
      targetFrame.src = `${u.pathname}${u.search}`;
      setFrameHint("");
    } else {
      targetFrame.src = toProxyUrl(normalizedUrl);
      setFrameHint(
        "Page is loaded through local proxy mode. Some highly dynamic or login-heavy sites may still behave differently."
      );
    }
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

function normalizeTagName(element) {
  return String(element?.tagName || "").toLowerCase();
}

function classifyAttentionBucket(hitElement) {
  if (!hitElement) {
    return "other";
  }
  let current = hitElement;
  let fallbackTag = normalizeTagName(hitElement);
  while (current && current.nodeType === 1) {
    const tag = normalizeTagName(current);
    if (tag) {
      fallbackTag = tag;
    }
    const role = String(current.getAttribute?.("role") || "").toLowerCase();
    const ariaLabel = String(
      current.getAttribute?.("aria-label") || current.getAttribute?.("aria-labelledby") || ""
    ).toLowerCase();
    const className = String(current.className || "").toLowerCase();
    const idName = String(current.id || "").toLowerCase();
    const marker = String(current.getAttribute?.("data-track-region") || "").toLowerCase();
    const textContent = String(current.textContent || "").trim();

    if (
      tag === "nav" ||
      role === "navigation" ||
      marker.includes("nav") ||
      className.includes("nav") ||
      idName.includes("nav")
    ) {
      return "navigation";
    }
    if (
      tag === "button" ||
      tag === "a" ||
      tag === "input" ||
      tag === "select" ||
      tag === "textarea" ||
      role === "button" ||
      role === "link" ||
      role === "menuitem" ||
      role === "tab" ||
      role === "switch" ||
      role === "checkbox" ||
      role === "radio" ||
      current.hasAttribute?.("onclick")
    ) {
      return "interactive";
    }
    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") {
      return "headings";
    }
    if (tag === "img" || tag === "video" || tag === "canvas" || tag === "svg" || role === "img") {
      return "media";
    }
    if (
      tag === "p" ||
      tag === "article" ||
      tag === "section" ||
      role === "article" ||
      marker.includes("text") ||
      marker.includes("content") ||
      ariaLabel.includes("content") ||
      (textContent.length >= 40 && !["button", "a", "input"].includes(tag))
    ) {
      return "main_text";
    }
    current = current.parentElement;
  }

  if (fallbackTag === "img" || fallbackTag === "video" || fallbackTag === "canvas" || fallbackTag === "svg") {
    return "media";
  }
  if (fallbackTag === "a" || fallbackTag === "button" || fallbackTag === "input") {
    return "interactive";
  }
  return "other";
}

function isMeaningfulAttentionBucket(bucketKey) {
  return MEANINGFUL_ATTENTION_BUCKETS.has(bucketKey);
}

function getAttentionGroupAvailability() {
  const frameDocument = getFrameDocument();
  const availability = {};
  for (const bucketKey of MEANINGFUL_ATTENTION_BUCKETS) {
    const selector = ATTENTION_GROUP_SELECTORS[bucketKey];
    let elementCount = 0;
    if (frameDocument && selector) {
      try {
        elementCount = frameDocument.querySelectorAll(selector).length;
      } catch (_) {
        elementCount = 0;
      }
    }
    availability[bucketKey] = {
      available: elementCount > 0,
      element_count: elementCount
    };
  }
  return availability;
}

function getNearHitProbeOffsets() {
  return [
    [8, 0],
    [-8, 0],
    [0, 8],
    [0, -8],
    [16, 0],
    [-16, 0],
    [0, 16],
    [0, -16],
    [16, 16],
    [-16, 16],
    [16, -16],
    [-16, -16],
    [24, 0],
    [-24, 0],
    [0, 24],
    [0, -24],
    [32, 0],
    [-32, 0],
    [0, 32],
    [0, -32],
    [24, 24],
    [-24, 24],
    [24, -24],
    [-24, -24]
  ];
}
//Perform a near-hit when key elements are not hit.
function getBestNearHitFromPoint(frameDocument, framePoint) {
  const candidates = new Map();
  const viewport = frameDocument.defaultView;
  for (const [dx, dy] of getNearHitProbeOffsets()) {
    const distance = Math.hypot(dx, dy);
    const probeX = framePoint.x + dx;
    const probeY = framePoint.y + dy;
    const elements =
      typeof frameDocument.elementsFromPoint === "function"
        ? frameDocument.elementsFromPoint(probeX, probeY)
        : [frameDocument.elementFromPoint(probeX, probeY)].filter(Boolean);
    for (const element of elements) {
      const bucketKey = classifyAttentionBucket(element);
      if (!isMeaningfulAttentionBucket(bucketKey)) {
        continue;
      }
      const radius = NEAR_HIT_RADIUS_BY_BUCKET[bucketKey] || 20;
      if (distance > radius) {
        continue;
      }
      const rect = element.getBoundingClientRect?.();
      if (rect && viewport) {
        const clampedX = Math.max(rect.left, Math.min(framePoint.x, rect.right));
        const clampedY = Math.max(rect.top, Math.min(framePoint.y, rect.bottom));
        if (Math.hypot(framePoint.x - clampedX, framePoint.y - clampedY) > radius) {
          continue;
        }
      }
      const existing = candidates.get(bucketKey);
      if (!existing || distance < existing.distance) {
        candidates.set(bucketKey, { element, bucketKey, distance });
      }
    }
  }
  return [...candidates.values()].sort((a, b) => {
    const priorityDelta =
      (ATTENTION_BUCKET_PRIORITY[b.bucketKey] || 0) -
      (ATTENTION_BUCKET_PRIORITY[a.bucketKey] || 0);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    return a.distance - b.distance;
  })[0] || null;
}

function resolveAttentionHit(clientPoint) {
  const frameDocument = getFrameDocument();
  const framePoint = getPointInsideFrame(clientPoint);
  if (!frameDocument || !framePoint) {
    return { bucketKey: "other", hitType: "exact", weight: 1 };
  }
//Locate elements within the iframe document
  const exactElement = frameDocument.elementFromPoint(framePoint.x, framePoint.y);
  const exactBucketKey = classifyAttentionBucket(exactElement);
  if (isMeaningfulAttentionBucket(exactBucketKey)) {
    return {
      bucketKey: exactBucketKey,
      hitType: "exact",
      weight: 1,
      element: exactElement
    };
  }

  const nearHit = getBestNearHitFromPoint(frameDocument, framePoint);
  if (nearHit) {
    return {
      bucketKey: nearHit.bucketKey,
      hitType: "near",
      weight: NEAR_HIT_WEIGHT,
      element: nearHit.element
    };
  }

  return {
    bucketKey: exactBucketKey || "other",
    hitType: "exact",
    weight: 1,
    element: exactElement
  };
}
//Recorded attention summary
function updateAttentionSummary(clientPoint, elapsedDurationMs) {
  const hit = resolveAttentionHit(clientPoint);
  const bucketKey = hit.bucketKey;
  const bucket = state.attentionSummary.buckets[bucketKey];
  if (!bucket) {
    return;
  }
  bucket.hit_count += 1;
  if (hit.hitType === "near") {
    bucket.near_hit_count += 1;
    state.attentionSummary.total_near_hit_count += 1;
  } else {
    bucket.exact_hit_count += 1;
  }
  bucket.weighted_hit_score += hit.weight;
  if (bucket.first_fixation_ms == null) {
    bucket.first_fixation_ms = Math.max(0, Math.round(elapsedDurationMs));
  }
  bucket.dwell_ms += HEAT_SAMPLE_INTERVAL_MS;
  bucket.weighted_dwell_ms += HEAT_SAMPLE_INTERVAL_MS * hit.weight;
  state.attentionSummary.total_hit_count += 1;
  state.attentionSummary.total_weighted_hit_score += hit.weight;
  state.attentionSummary.total_dwell_ms += HEAT_SAMPLE_INTERVAL_MS;
  state.attentionSummary.total_weighted_dwell_ms += HEAT_SAMPLE_INTERVAL_MS * hit.weight;
}

function getFrameWindow() {
  if (!targetFrame) {
    return null;
  }
  try {
    return targetFrame.contentWindow || null;
  } catch (_) {
    return null;
  }
}

function getFrameScrollOffsets() {
  const frameWindow = getFrameWindow();
  const frameDocument = getFrameDocument();
  const root = frameDocument?.documentElement;
  const body = frameDocument?.body;

  return {
    x: Math.max(0, frameWindow?.scrollX ?? root?.scrollLeft ?? body?.scrollLeft ?? 0),
    y: Math.max(0, frameWindow?.scrollY ?? root?.scrollTop ?? body?.scrollTop ?? 0)
  };
}

function getFrameDocumentSize() {
  const rect = getViewportRect();
  const frameDocument = getFrameDocument();
  const root = frameDocument?.documentElement;
  const body = frameDocument?.body;

  return {
    width: Math.max(
      rect.width,
      root?.scrollWidth ?? 0,
      root?.clientWidth ?? 0,
      body?.scrollWidth ?? 0,
      body?.clientWidth ?? 0
    ),
    height: Math.max(
      rect.height,
      root?.scrollHeight ?? 0,
      root?.clientHeight ?? 0,
      body?.scrollHeight ?? 0,
      body?.clientHeight ?? 0
    )
  };
}

function getFrameVisibleDocSize() {
  const { width: docW, height: docH } = getFrameDocumentSize();
  const doc = getFrameDocument();
  const root = doc?.documentElement;
  const fw = getFrameWindow();
  const fallbackW = targetFrame?.clientWidth ?? docW;
  const fallbackH = targetFrame?.clientHeight ?? docH;

  const visW = Math.max(
    1,
    Math.min(docW, root?.clientWidth ?? fw?.innerWidth ?? fallbackW)
  );
  const visH = Math.max(
    1,
    Math.min(docH, root?.clientHeight ?? fw?.innerHeight ?? fallbackH)
  );

  return { visW, visH, docW, docH };
}

function getPointInsideFrame(clientPoint) {
  if (!targetFrame || !clientPoint) {
    return null;
  }
//Map the gaze point to the iframe coordinates
  const frameRect = targetFrame.getBoundingClientRect();
  return {
    x: clientPoint.x - frameRect.left,
    y: clientPoint.y - frameRect.top
  };
}

function isViewportAnchoredElement(clientPoint) {
  const frameDocument = getFrameDocument();
  const frameWindow = getFrameWindow();
  const framePoint = getPointInsideFrame(clientPoint);

  if (!frameDocument || !frameWindow || !framePoint) {
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

  const element = frameDocument.elementFromPoint(framePoint.x, framePoint.y);
  if (!element) {
    return false;
  }

  let current = element;
  while (current && current.nodeType === 1) {
    const style = frameWindow.getComputedStyle(current);
    if (style.position === "fixed" || style.position === "sticky") {
      return true;
    }
    current = current.parentElement;
  }

  return false;
}

function renderHeatmap() {
  const rect = getViewportRect();
  const scrollOffsets = getFrameScrollOffsets();
  heatCtx.clearRect(0, 0, rect.width, rect.height);

  for (const sample of state.heatSamples) {
    const x = sample.anchorToViewport ? sample.docX : sample.docX - scrollOffsets.x;
    const y = sample.anchorToViewport ? sample.docY : sample.docY - scrollOffsets.y;

    if (x < -80 || x > rect.width + 80 || y < -80 || y > rect.height + 80) {
      continue;
    }

    drawHeatPoint(x, y);
  }
}

function attachFrameScrollTracking() {
  if (detachFrameScrollListener) {
    detachFrameScrollListener();
    detachFrameScrollListener = null;
  }

  const frameWindow = getFrameWindow();
  if (!frameWindow) {
    return;
  }

  let rafId = 0;
  const onScroll = () => {
    if (rafId) {
      return;
    }
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      renderHeatmap();
      drawCoverageMap();
    });
  };

  frameWindow.addEventListener("scroll", onScroll, { passive: true });
  detachFrameScrollListener = () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    frameWindow.removeEventListener("scroll", onScroll);
  };
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
      if (parsed.pathname.includes("/eye/temp-html/")) {
        return "Uploaded HTML (temporary)";
      }
      return parsed.hostname || state.currentTargetUrl;
    } catch (_) {
      return state.currentTargetUrl;
    }
  }
  return "Eye Tracking Session";
}

function buildEyeSessionPayload() {
  const runId = (state.relatedRunId || "").trim();
  const totalDwell = Math.max(1, state.attentionSummary.total_dwell_ms);
  const totalWeightedDwell = Math.max(1, state.attentionSummary.total_weighted_dwell_ms);
  const totalWeightedHits = Math.max(1, state.attentionSummary.total_weighted_hit_score);
  const groupAvailability = getAttentionGroupAvailability();
  const attentionSummary = ATTENTION_BUCKETS.map((bucket) => {
    const data = state.attentionSummary.buckets[bucket.key];
    return {
      key: bucket.key,
      label: bucket.label,
      hit_detection_method: HIT_DETECTION_METHOD,
      element_available: Boolean(groupAvailability[bucket.key]?.available),
      element_count: groupAvailability[bucket.key]?.element_count || 0,
      hit_count: data.hit_count,
      exact_hit_count: data.exact_hit_count,
      near_hit_count: data.near_hit_count,
      weighted_hit_score: Number(data.weighted_hit_score.toFixed(2)),
      dwell_ms: data.dwell_ms,
      weighted_dwell_ms: Math.round(data.weighted_dwell_ms),
      first_fixation_ms: data.first_fixation_ms,
      share: Number((data.dwell_ms / totalDwell).toFixed(4)),
      weighted_share: Number((data.weighted_dwell_ms / totalWeightedDwell).toFixed(4)),
      weighted_hit_share: Number((data.weighted_hit_score / totalWeightedHits).toFixed(4))
    };
  }).filter((item) => item.hit_count > 0 || item.element_available);

  const documentSize = getFrameDocumentSize();
  const visibleSize = getFrameVisibleDocSize();

  return {
    run_id: runId,
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
      last_saved_session_id: state.lastSavedSessionId || null,
      hit_detection_method: HIT_DETECTION_METHOD,
      attention_group_availability: groupAvailability,
      attention_summary: attentionSummary,
      attention_total_hits: state.attentionSummary.total_hit_count,
      attention_total_near_hits: state.attentionSummary.total_near_hit_count,
      attention_total_weighted_hit_score: Number(
        state.attentionSummary.total_weighted_hit_score.toFixed(2)
      ),
      attention_total_dwell_ms: state.attentionSummary.total_dwell_ms,
      attention_total_weighted_dwell_ms: Math.round(
        state.attentionSummary.total_weighted_dwell_ms
      ),
      document_width: Math.round(documentSize.width),
      document_height: Math.round(documentSize.height),
      viewport_width: Math.round(visibleSize.visW),
      viewport_height: Math.round(visibleSize.visH)
    }
  };
}

async function saveCurrentSession() {
  if (state.saving) {
    return;
  }
  if (state.savedThisRun) {
    setStatus("This eye session has already been saved.");
    return;
  }
  const runId = (state.relatedRunId || "").trim();
  if (!runId) {
    setStatus(
      "Link this session to an analysis first: run an analysis on the dashboard, then open Eye Tracking from the top navigation (or add ?run_id=… to this page URL)."
    );
    return;
  }
  if (!state.currentTargetUrl || state.samples <= 0) {
    setStatus("Track a page first before saving an eye session.");
    return;
  }

  state.saving = true;
  updateSaveButtonState();

  try {
    // eslint-disable-next-line no-console
    console.log("Saving eye session for run:", runId);
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
    state.savedThisRun = true;
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

async function uploadHtmlForEyeSession(file) {
  if (!loadHtmlBtn) {
    return;
  }
  loadHtmlBtn.disabled = true;
  setStatus("Uploading HTML…");
  try {
    const html = await file.text();
    const response = await fetch("/eye/temp-html", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ html })
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const errBody = await response.json();
        if (errBody?.detail) {
          detail =
            typeof errBody.detail === "string"
              ? errBody.detail
              : JSON.stringify(errBody.detail);
        }
      } catch (_) {
        // Keep the fallback status text.
      }
      throw new Error(detail);
    }

    const payload = await response.json();
    const path = payload?.path;
    if (!path || typeof path !== "string") {
      throw new Error("Server did not return a preview path.");
    }
    loadTempHtmlPreview(path, file.name);
  } finally {
    loadHtmlBtn.disabled = false;
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
  state.heatSamples = [];
  state.pausedDurationMs = 0;
  state.pausedAtPerf = 0;
  state.sessionStartPerf = state.started ? performance.now() : 0;
  state.sessionStartedAtIso = state.started ? new Date().toISOString() : "";
  state.lastSavedSessionId = "";
  state.savedThisRun = false;
  state.attentionSummary = createAttentionSummaryState();
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
  ensureCoverageCanvasFixedSize();
  const vw = COVERAGE_VIEW_W;
  const vh = COVERAGE_VIEW_H;
  const {
    mapW,
    mapH,
    offsetX,
    offsetY,
    visW,
    visH,
    docW,
    docH,
    scrollX,
    scrollY
  } = getCoveragePanLayout();

  coverageCtx.clearRect(0, 0, vw, vh);
  coverageCtx.fillStyle = "#020617";
  coverageCtx.fillRect(0, 0, vw, vh);

  const cellW = mapW / state.gridCols;
  const cellH = mapH / state.gridRows;

  coverageCtx.save();
  coverageCtx.beginPath();
  coverageCtx.rect(0, 0, vw, vh);
  coverageCtx.clip();
  coverageCtx.translate(-offsetX, -offsetY);

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
      coverageCtx.fillRect(col * cellW, row * cellH, cellW, cellH);
    }
  }

  coverageCtx.strokeStyle = "rgba(148, 163, 184, 0.18)";
  coverageCtx.lineWidth = 1;
  for (let col = 1; col < state.gridCols; col += 1) {
    const x = Math.round(col * cellW) + 0.5;
    coverageCtx.beginPath();
    coverageCtx.moveTo(x, 0);
    coverageCtx.lineTo(x, mapH);
    coverageCtx.stroke();
  }
  for (let row = 1; row < state.gridRows; row += 1) {
    const y = Math.round(row * cellH) + 0.5;
    coverageCtx.beginPath();
    coverageCtx.moveTo(0, y);
    coverageCtx.lineTo(mapW, y);
    coverageCtx.stroke();
  }

  const vpLeft = (scrollX / docW) * mapW;
  const vpTop = (scrollY / docH) * mapH;
  const vpW = (visW / docW) * mapW;
  const vpH = (visH / docH) * mapH;
  coverageCtx.strokeStyle = "rgba(226, 232, 240, 0.95)";
  coverageCtx.lineWidth = 2;
  coverageCtx.strokeRect(vpLeft + 0.5, vpTop + 0.5, Math.max(0, vpW - 1), Math.max(0, vpH - 1));

  coverageCtx.restore();
}

function updateCoverage(x, y, width, height) {
  if (!width || !height) {
    return;
  }
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
  const scrollOffsets = getFrameScrollOffsets();
  const anchorToViewport = isViewportAnchoredElement(point);
  const documentPoint = {
    x: anchorToViewport ? x : x + scrollOffsets.x,
    y: anchorToViewport ? y : y + scrollOffsets.y
  };

  gazeDot.style.opacity = "1";
  gazeDot.style.left = `${x}px`;
  gazeDot.style.top = `${y}px`;

  const needHeatSampleByTime = now - state.lastHeatSampleTime >= HEAT_SAMPLE_INTERVAL_MS;
  const needHeatSampleByMove =
    !state.lastHeatPoint ||
    distance(state.lastHeatPoint, documentPoint) >= HEAT_MIN_DISTANCE_PX;

  if (needHeatSampleByTime && needHeatSampleByMove) {
    state.heatSamples.push({
      docX: documentPoint.x,
      docY: documentPoint.y,
      anchorToViewport
    });
    if (state.heatSamples.length > 6000) {
      state.heatSamples.shift();
    }

    const documentSize = getFrameDocumentSize();
    const coveragePoint = {
      x: x + scrollOffsets.x,
      y: y + scrollOffsets.y
    };

    renderHeatmap();
    updateAttentionSummary(point, currentDurationMs());
    updateCoverage(
      coveragePoint.x,
      coveragePoint.y,
      documentSize.width,
      documentSize.height
    );
    drawCoverageMap();
    state.lastHeatSampleTime = now;
    state.lastHeatPoint = documentPoint;
  }

  state.samples += 1;
  samplesText.textContent = String(state.samples);
  coordsText.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
  updateSaveButtonState();
}

function beginTracking() {
  if (!window.GazeCloudAPI) {
    throw new Error("GazeCloudAPI script did not load.");
  }

  // Use the simplified calibration pattern (fewer points) for faster startup.
  window.GazeCloudAPI.CalibrationType = 1;
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
  setStatus("Preparing eye tracking...");
  updateSaveButtonState();
  window.setTimeout(() => {
    if (!state.started) {
      return;
    }
    setStatus("Starting GazeCloudAPI. Allow camera access and follow the calibration overlay.");
    window.GazeCloudAPI.StartEyeTracking();
  }, TRACKING_START_DELAY_MS);
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

loadHtmlBtn?.addEventListener("click", () => {
  loadHtmlInput?.click();
});

loadHtmlInput?.addEventListener("change", () => {
  const file = loadHtmlInput.files && loadHtmlInput.files[0];
  loadHtmlInput.value = "";
  if (!file) {
    return;
  }
  const lower = String(file.name || "").toLowerCase();
  if (!lower.endsWith(".html") && !lower.endsWith(".htm") && file.type !== "text/html") {
    setStatus("Please choose an .html or .htm file.");
    return;
  }
  uploadHtmlForEyeSession(file).catch((error) => {
    setStatus(`Upload failed: ${getErrorMessage(error)}`);
  });
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
    attachFrameScrollTracking();
    attachCoverageDocumentResizeTracking();
    ensureCoverageCanvasFixedSize();
    renderHeatmap();
    drawCoverageMap();
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
  ensureCoverageCanvasFixedSize();
  renderHeatmap();
  drawCoverageMap();
});

window.addEventListener("pageshow", () => {
  refreshRelatedRunFromStorage();
  updateSaveButtonState();
});

window.addEventListener("beforeunload", () => {
  if (detachCoverageResizeObserver) {
    detachCoverageResizeObserver();
    detachCoverageResizeObserver = null;
  }
  if (detachFrameScrollListener) {
    detachFrameScrollListener();
    detachFrameScrollListener = null;
  }
  if (window.GazeCloudAPI && typeof window.GazeCloudAPI.StopEyeTracking === "function") {
    window.GazeCloudAPI.StopEyeTracking();
  }
});

aboutEyeTrackingBtn?.addEventListener("click", () => {
  showEyeIntroModal();
});

eyeIntroContinueBtn?.addEventListener("click", () => {
  hideEyeIntroModal();
});

eyeIntroModal?.addEventListener("click", (event) => {
  if (event.target === eyeIntroModal) {
    hideEyeIntroModal();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && eyeIntroModal && !eyeIntroModal.hidden) {
    hideEyeIntroModal();
  }
});

window.addEventListener("pointermove", (event) => {
  updateIntroPupils(event.clientX, event.clientY);
});

window.addEventListener("pointerleave", () => {
  resetIntroPupils();
});

resizeHeatmapCanvas();
ensureCoverageCanvasFixedSize();
drawCoverageMap();
setPreviewVisibility(false);
setTrackingControlsEnabled(false);

const preferredTargetUrl = readPreferredTargetUrl();
initBackToAnalysisButton();
if (urlInput && preferredTargetUrl) {
  urlInput.value = preferredTargetUrl;
}

if (urlInput && urlInput.value) {
  loadTargetUrl(urlInput.value);
}

showEyeIntroModal();
