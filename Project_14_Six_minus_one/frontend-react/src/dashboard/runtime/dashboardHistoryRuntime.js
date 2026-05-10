import { logDashboardRuntime } from "./dashboardLifecycleForensics.js";

function ensureHistoryContextRuntime(ctx) {
  // Ownership extraction only: preserve existing behavior.
  if (!ctx.isHistoryReportView()) {
    ctx.clearHistoryReportContext();
    logDashboardRuntime("history.context.cleared", {});
  }
}

export { ensureHistoryContextRuntime };

