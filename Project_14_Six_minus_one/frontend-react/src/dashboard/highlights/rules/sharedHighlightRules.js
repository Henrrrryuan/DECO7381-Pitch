import { emitDashboardForensicEvent, forensicBusEnabled } from "../../observability/forensicBus.js";

function highlightForensicEnabled() {
  return typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_HIGHLIGHT_FORENSIC === "1");
}

function logHighlightEngine(payload) {
  if (!highlightForensicEnabled()) {
    return;
  }
  console.log("[Highlight engine]", payload);
  // Observability augmentation only (DEV/opt-in): preserve log format above.
  if (forensicBusEnabled()) {
    emitDashboardForensicEvent({
      type: "highlight",
      payload: {
        kind: "highlight.engine",
        at: Date.now(),
        summary: {
          rule_id: String(payload?.rule_id || payload?.ruleId || ""),
          matched_count: Number(payload?.matched_count || payload?.matchedCount || 0),
          final_target_tag: String(payload?.final_target_tag || payload?.finalTargetTag || ""),
        },
      },
    });
  }
}

function defaultFallbackSelectorsForIssue(issue, dimensionName, HIGHLIGHT_CONFIG) {
  const ruleId = issue?.rule_id || "";
  if (ruleId === "SC-1") {
    return [];
  }
  if (ruleId === "LC-1") {
    return [];
  }
  if (ruleId === "DT-1") {
    return [];
  }
  if (ruleId === "PHS-1") {
    return [];
  }
  if (ruleId === "NC-1") {
    return [];
  }
  if (ruleId === "WIP-1") {
    return [];
  }
  if (ruleId === "VO-1") {
    return [];
  }
  return HIGHLIGHT_CONFIG?.[dimensionName]?.selectors || [];
}

export {
  defaultFallbackSelectorsForIssue,
  highlightForensicEnabled,
  logHighlightEngine,
};

