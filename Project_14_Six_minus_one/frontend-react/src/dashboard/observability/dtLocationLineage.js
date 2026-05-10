function dtLineageEnabled() {
  return typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_DT1_LINEAGE === "1");
}

function hashText(value) {
  const text = String(value || "");
  // djb2-ish, stable, lightweight (DEV-only usage)
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function dtLocationsFromPayload(payload) {
  const dims = payload?.dimensions || payload?.result?.dimensions || payload?.analysis?.dimensions || [];
  const dtDim = Array.isArray(dims) ? dims.find((d) => d?.dimension === "Dense Text Detection") : null;
  const issues = dtDim?.issues || [];
  const issue = issues.find((i) => i?.rule_id === "DT-1") || null;
  const locs = issue?.locations || [];
  return Array.isArray(locs) ? locs : [];
}

function summarizeDtLocations(payload) {
  const locs = dtLocationsFromPayload(payload);
  return summarizeDtLocationArray(locs);
}

function summarizeDtLocationArray(locs) {
  const safeLocs = Array.isArray(locs) ? locs : [];
  const selectors = [];
  const texts = [];
  const ids = safeLocs.map((loc, index) => {
    const selector = String(loc?.selector || "");
    const tag = String(loc?.tag || "");
    const attrs = loc?.attrs && typeof loc.attrs === "object" ? loc.attrs : {};
    const domId = String(attrs?.id || "");
    const caseId = String(attrs?.["data-case-id"] || "");
    const text = String(loc?.text || loc?.preview || "");
    selectors.push(selector);
    texts.push(text);
    const textHash = hashText(text);
    return `dt:${index}:${selector}:${tag}:${domId}:${caseId}:${textHash}`;
  });

  const selectorCounts = selectors.reduce((acc, s) => {
    const key = String(s || "");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const textCounts = texts.reduce((acc, s) => {
    const key = String(s || "");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const duplicate_selector_count = Object.values(selectorCounts).filter((n) => n > 1).length;
  const duplicate_text_count = Object.values(textCounts).filter((n) => n > 1).length;

  return {
    dt_location_count: safeLocs.length,
    dt_location_ids: ids,
    selectors,
    duplicate_selector_count,
    duplicate_text_count,
  };
}

function logDtLineage(stage, payload, extra = {}) {
  if (!dtLineageEnabled()) {
    return;
  }
  const summary = summarizeDtLocations(payload);
  console.log("[DT-1 location lineage]", {
    stage,
    ...summary,
    ...extra,
  });
}

export {
  dtLineageEnabled,
  dtLocationsFromPayload,
  summarizeDtLocations,
  summarizeDtLocationArray,
  logDtLineage,
};

