function renderForensicEnabled() {
  return typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_RENDER_FORENSIC === "1");
}

function logRenderContext({
  renderer,
  context_type,
  issue_rule,
  selected,
  render_size,
} = {}) {
  if (!renderForensicEnabled()) {
    return;
  }
  console.log("[Render context]", {
    renderer: String(renderer || ""),
    context_type: String(context_type || ""),
    issue_rule: String(issue_rule || ""),
    selected: Boolean(selected),
    render_size: Number(render_size || 0),
  });
  // Observability augmentation only (DEV/opt-in): preserve log format above.
  try {
    // Lazy import to avoid hard dependency when forensics disabled.
    import("../../observability/forensicBus.js").then(({ emitDashboardForensicEvent, forensicBusEnabled }) => {
      if (!forensicBusEnabled()) {
        return;
      }
      emitDashboardForensicEvent({
        type: "render",
        payload: {
          kind: "render.context",
          at: Date.now(),
          summary: {
            renderer: String(renderer || ""),
            context_type: String(context_type || ""),
            issue_rule: String(issue_rule || ""),
            selected: Boolean(selected),
            render_size: Number(render_size || 0),
          },
        },
      });
    });
  } catch (_) {
    // ignore
  }
}

export { logRenderContext, renderForensicEnabled };

