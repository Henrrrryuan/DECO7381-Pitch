import { logDashboardIframe } from "./dashboardLifecycleForensics.js";

function startDashboardIframeRuntime(ctx) {
  // Ownership extraction only: bind listeners exactly as before.
  const websitePreviewFrame = document.getElementById("websitePreviewFrame");
  if (!websitePreviewFrame) {
    return;
  }
  websitePreviewFrame.addEventListener("load", () => {
    const doc = ctx.getPreviewDocument();
    if (!doc) {
      ctx.setWebsiteStatus("Preview loaded, but browser security blocked direct highlighting.", true);
      return;
    }
    logDashboardIframe({ stage: "iframe.load" });
    ctx.applyIframePreviewBootstrap(doc);
  });
}

export { startDashboardIframeRuntime };

