let _seq = 0;

function lineageForensicEnabled() {
  return typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_DT1_FORENSIC === "1" || import.meta.env?.VITE_RUNTIME_FORENSIC === "1");
}

function perfNow() {
  try {
    return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  } catch (_) {
    return Date.now();
  }
}

function nextSeq() {
  _seq += 1;
  return _seq;
}

function summarizeRun(payloadOrSessionPayload) {
  const payload = payloadOrSessionPayload || null;
  const runId = String(payload?.run?.run_id || payload?.run_id || payload?.run?.id || "");
  const source = String(payload?.run?.source_name || payload?.source_name || payload?.sourceName || "");
  return { run_id: runId, source_name: source };
}

function dtLocationsFromPayload(payload) {
  const dims = payload?.dimensions || payload?.result?.dimensions || payload?.analysis?.dimensions || [];
  const dtDim = Array.isArray(dims) ? dims.find((d) => d?.dimension === "Dense Text Detection") : null;
  const issues = dtDim?.issues || [];
  const issue = issues.find((i) => i?.rule_id === "DT-1") || issues[0] || null;
  const locs = issue?.locations || [];
  return Array.isArray(locs) ? locs.length : 0;
}

function logLineageTimeline(kind, detail = {}) {
  if (!lineageForensicEnabled()) {
    return;
  }
  const entry = {
    seq: nextSeq(),
    t: perfNow(),
    kind: String(kind || ""),
    path: typeof window !== "undefined" ? String(window.location?.pathname || "") : "",
    ...detail,
  };
  console.log("[DT lineage timeline]", entry);
}

export {
  dtLocationsFromPayload,
  lineageForensicEnabled,
  logLineageTimeline,
  summarizeRun,
};

