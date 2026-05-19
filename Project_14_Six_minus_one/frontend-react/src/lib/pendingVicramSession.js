/** Session cache for ViCRAM results computed on the loading page before dashboard mount. */

export const PENDING_VICRAM_RESULT_KEY = "pendingVicramResult";

export const VICRAM_LOADING_OPTIONS = {
  rows: 20,
  columns: 20,
  viewportWidth: 1366,
  viewportHeight: 768,
};

function isProbablyUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function isPreviewRouteUrl(value) {
  return String(value || "").trim().startsWith("/preview/");
}

function absolutePreviewUrl(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  if (isProbablyUrl(text)) {
    return text;
  }
  if (isPreviewRouteUrl(text) && typeof window !== "undefined") {
    return new URL(text, window.location.origin).toString();
  }
  return "";
}

/** Canonical label for matching pending ViCRAM cache to dashboard source. */
export function normalizeVicramTargetLabel(label) {
  const value = String(label || "").trim();
  if (!value) {
    return "";
  }

  if (isProbablyUrl(value)) {
    try {
      const url = new URL(value);
      url.hash = "";
      const pathname = url.pathname.replace(/\/+$/, "") || "";
      return `${url.protocol}//${url.host.toLowerCase()}${pathname}${url.search}`;
    } catch {
      return value.toLowerCase().replace(/\/+$/, "");
    }
  }

  return value.toLowerCase();
}

export function vicramTargetLabelsMatch(storedLabel, currentLabel) {
  const left = normalizeVicramTargetLabel(storedLabel);
  const right = normalizeVicramTargetLabel(currentLabel);
  return Boolean(left) && left === right;
}

/** Label used by dashboard `getVicramAnalysisSource()` after session hydrate. */
export function resolveVicramTargetLabel(sessionResult) {
  const previewUrl = String(sessionResult?.payload?.preview_url || "").trim();
  const sourceUrl = String(sessionResult?.sourceUrl || "").trim();
  const sourceName = String(sessionResult?.sourceName || "").trim();
  const absolutePreview = absolutePreviewUrl(previewUrl);

  if (absolutePreview) {
    return absolutePreview;
  }
  if (isProbablyUrl(sourceUrl)) {
    return sourceUrl;
  }
  if (isProbablyUrl(sourceName)) {
    return sourceName;
  }
  return sourceName || "Uploaded HTML";
}

export function buildVicramSourcePayloadFromPending(pending) {
  if (pending?.mode === "url") {
    const url = String(pending.url || "").trim();
    return { payload: { url }, targetUrl: url };
  }

  const html = String(pending?.html || "").trim();
  return {
    payload: { html },
    targetUrl: pending?.fileName || "uploaded.html",
  };
}

export function buildVicramSourcePayloadFromMain(main) {
  const previewUrl = String(main?.payload?.preview_url || "").trim();
  const sourceUrl = String(main?.sourceUrl || "").trim();
  const html = String(main?.html || main?.payload?.html_content || "").trim();
  const absolutePreview = absolutePreviewUrl(previewUrl);

  if (main?.sourceType === "url" || isProbablyUrl(sourceUrl)) {
    const url = sourceUrl || previewUrl;
    return { payload: { url }, targetUrl: resolveVicramTargetLabel(main) };
  }
  if (absolutePreview) {
    return { payload: { url: absolutePreview }, targetUrl: resolveVicramTargetLabel(main) };
  }
  return {
    payload: { html },
    targetUrl: resolveVicramTargetLabel(main),
  };
}

function buildPendingVicramEntry({ result, targetUrl, includeScreenshot = true }) {
  const artifacts = result?.artifacts || {};
  return {
    result: {
      ...result,
      artifacts: includeScreenshot
        ? artifacts
        : {
            overlay_svg: artifacts.overlay_svg,
            overlay_svg_base64: artifacts.overlay_svg_base64,
          },
    },
    targetUrl,
    page: result.page || null,
    grid: result.grid || null,
    overlay_svg_base64: artifacts.overlay_svg_base64 || "",
  };
}

export function savePendingVicramResult({ result, targetUrl }) {
  const canonicalTargetUrl = normalizeVicramTargetLabel(targetUrl);
  if (!result || !canonicalTargetUrl) {
    return;
  }

  const entry = buildPendingVicramEntry({ result, targetUrl: canonicalTargetUrl, includeScreenshot: true });

  try {
    sessionStorage.setItem(PENDING_VICRAM_RESULT_KEY, JSON.stringify(entry));
    return;
  } catch {
    // Large screenshots can exceed sessionStorage quota; keep score, grid, and preview overlay.
    try {
      const slimEntry = buildPendingVicramEntry({ result, targetUrl: canonicalTargetUrl, includeScreenshot: false });
      sessionStorage.setItem(PENDING_VICRAM_RESULT_KEY, JSON.stringify(slimEntry));
    } catch {
      clearPendingVicramResult();
    }
  }
}

export function clearPendingVicramResult() {
  sessionStorage.removeItem(PENDING_VICRAM_RESULT_KEY);
}

export function readPendingVicramResult() {
  const raw = sessionStorage.getItem(PENDING_VICRAM_RESULT_KEY);
  if (!raw) {
    return null;
  }

  try {
    const entry = JSON.parse(raw);
    if (!entry?.result || !entry?.targetUrl) {
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}
