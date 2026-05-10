function runtimeForensicEnabled() {
  return typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_RUNTIME_FORENSIC === "1");
}

function logDashboardRuntime(tag, details) {
  if (!runtimeForensicEnabled()) {
    return;
  }
  console.log(`[Dashboard runtime] ${tag}`, details || {});
}

function logDashboardBootstrap(details) {
  if (!runtimeForensicEnabled()) {
    return;
  }
  console.log("[Dashboard bootstrap]", details || {});
}

function logDashboardHydration(details) {
  if (!runtimeForensicEnabled()) {
    return;
  }
  console.log("[Dashboard hydration]", details || {});
}

function logDashboardIframe(details) {
  if (!runtimeForensicEnabled()) {
    return;
  }
  console.log("[Dashboard iframe]", details || {});
}

function logDashboardRenderRuntime(details) {
  if (!runtimeForensicEnabled()) {
    return;
  }
  console.log("[Dashboard render runtime]", details || {});
}

export {
  logDashboardBootstrap,
  logDashboardHydration,
  logDashboardIframe,
  logDashboardRenderRuntime,
  logDashboardRuntime,
  runtimeForensicEnabled,
};

