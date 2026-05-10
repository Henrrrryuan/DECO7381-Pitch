// Architecture governance only: pure metadata.

const DASHBOARD_DEPENDENCY_RULES = {
  shared: {
    allowed: [],
  },
  // Observability is treated as shared governance/forensics helpers.
  observability: {
    allowed: ["shared"],
  },
  detectors: {
    allowed: ["shared"],
  },
  highlights: {
    allowed: ["shared", "detectors"],
  },
  rendering: {
    allowed: ["shared", "detectors", "state"],
  },
  state: {
    allowed: ["shared"],
  },
  actions: {
    allowed: ["shared", "state", "runtime"],
  },
  runtime: {
    allowed: ["shared", "rendering", "state", "actions", "highlights"],
  },
  legacy: {
    // Transitional: legacy can depend on all layers.
    allowed: ["shared", "detectors", "highlights", "rendering", "state", "actions", "runtime", "legacy"],
  },
};

export { DASHBOARD_DEPENDENCY_RULES };

