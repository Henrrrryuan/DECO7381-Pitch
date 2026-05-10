function buildRuntimeLineage(traceContext) {
  return {
    trace_id: String(traceContext?.trace_id || ""),
    steps: [],
  };
}

function appendRuntimeLineageStep(lineage, step) {
  if (!lineage) {
    return lineage;
  }
  lineage.steps.push({
    at: Date.now(),
    step: String(step?.step || ""),
    detail: step?.detail ? String(step.detail) : "",
  });
  return lineage;
}

function summarizeRuntimeLineage(lineage, { maxSteps = 12 } = {}) {
  const steps = Array.isArray(lineage?.steps) ? lineage.steps : [];
  const tail = steps.slice(Math.max(0, steps.length - maxSteps));
  return {
    trace_id: String(lineage?.trace_id || ""),
    step_count: steps.length,
    tail: tail.map((s) => ({ step: s.step, detail: s.detail, at: s.at })),
  };
}

export { appendRuntimeLineageStep, buildRuntimeLineage, summarizeRuntimeLineage };

