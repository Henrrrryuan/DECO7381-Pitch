function nowMs() {
  return Date.now();
}

function shortId(prefix = "t") {
  // Lightweight, deterministic-enough for debugging (time + counter).
  const t = nowMs().toString(36);
  const r = Math.floor(Math.random() * 1e8).toString(36);
  return `${prefix}-${t}-${r}`;
}

function createDashboardTraceContext({
  runtime_phase = "",
  action_type = "",
  parent_trace_id = "",
  trace_id = "",
  timestamp = 0,
} = {}) {
  return {
    trace_id: trace_id || shortId("trace"),
    parent_trace_id: parent_trace_id || "",
    runtime_phase: String(runtime_phase || ""),
    action_type: String(action_type || ""),
    timestamp: Number(timestamp || nowMs()),
  };
}

function inheritDashboardTraceContext(parent, overrides = {}) {
  const base = parent && typeof parent === "object" ? parent : {};
  return createDashboardTraceContext({
    parent_trace_id: base.trace_id || "",
    runtime_phase: overrides.runtime_phase ?? base.runtime_phase ?? "",
    action_type: overrides.action_type ?? base.action_type ?? "",
  });
}

function summarizeDashboardTraceContext(ctx) {
  if (!ctx || typeof ctx !== "object") {
    return { trace_id: "", parent_trace_id: "", runtime_phase: "", action_type: "", timestamp: 0 };
  }
  return {
    trace_id: String(ctx.trace_id || ""),
    parent_trace_id: String(ctx.parent_trace_id || ""),
    runtime_phase: String(ctx.runtime_phase || ""),
    action_type: String(ctx.action_type || ""),
    timestamp: Number(ctx.timestamp || 0),
  };
}

export {
  createDashboardTraceContext,
  inheritDashboardTraceContext,
  summarizeDashboardTraceContext,
};

