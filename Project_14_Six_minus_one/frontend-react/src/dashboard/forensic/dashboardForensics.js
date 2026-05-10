import { getRunIdFromPayload as getRunIdFromPayloadDefault } from "../authority/dashboardAuthority.js";

function dt1FrontendForensicEnabled() {
  return typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_DT1_FORENSIC === "1");
}

function logDashboardLifecycle({
  stage,
  incomingPayload,
  currentPayload,
  incomingSourceType = "",
  currentSourceType = "",
  accepted = false,
  reason = "",
  getRunIdFromPayload,
}) {
  const runIdFn = getRunIdFromPayload || getRunIdFromPayloadDefault;
  console.log("[Dashboard lifecycle]", {
    stage,
    incoming_run_id: runIdFn ? runIdFn(incomingPayload) : "",
    current_run_id: runIdFn ? runIdFn(currentPayload) : "",
    incoming_source: incomingSourceType,
    current_source: currentSourceType,
    accepted,
    reason,
  });
}

function logDashboardAuthority(authoritativeSource) {
  console.log("[Dashboard authoritative source]", authoritativeSource);
}

function logDashboardRender({ runId, dtLocations, sourceType }) {
  console.log("[Dashboard render authoritative]", {
    run_id: runId,
    dt_locations: dtLocations,
    source_type: sourceType,
  });
}

function logDtFrontendState({
  stage,
  payload,
  result,
  sourceNameOverride = "",
  getRunIdFromPayload,
  getDtLocationsCountFromResult,
}) {
  if (!dt1FrontendForensicEnabled()) {
    return;
  }
  const runIdFn = getRunIdFromPayload || getRunIdFromPayloadDefault;
  const runId = runIdFn ? runIdFn(payload) : "";
  const source = sourceNameOverride
    || payload?.run?.source_name
    || payload?.source_name
    || payload?.sourceName
    || "";
  console.log("[DT frontend state]", {
    stage,
    source: String(source || ""),
    run_id: String(runId || ""),
    dt_locations: getDtLocationsCountFromResult ? getDtLocationsCountFromResult(result) : 0,
  });
}

export {
  dt1FrontendForensicEnabled,
  logDashboardAuthority,
  logDashboardLifecycle,
  logDashboardRender,
  logDtFrontendState,
};

