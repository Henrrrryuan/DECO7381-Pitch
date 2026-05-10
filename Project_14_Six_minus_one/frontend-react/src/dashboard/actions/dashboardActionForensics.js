function actionForensicEnabled() {
  return typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_ACTION_FORENSIC === "1");
}

function summarizePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }
  const out = {};
  ["dimensionName", "ruleId", "elementNumber", "workspaceMode", "profileName", "open", "restoreMode"].forEach((key) => {
    if (key in payload) {
      out[key] = payload[key];
    }
  });
  return out;
}

function logDashboardAction({ type, payload, affected_systems = [] } = {}) {
  if (!actionForensicEnabled()) {
    return;
  }
  console.log("[Dashboard action]", {
    type: String(type || ""),
    payload_summary: summarizePayload(payload),
    affected_systems: Array.isArray(affected_systems) ? affected_systems : [],
  });
}

export { actionForensicEnabled, logDashboardAction };

