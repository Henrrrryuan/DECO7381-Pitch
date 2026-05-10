const DASHBOARD_LAYERS = {
  shared: {
    name: "shared",
    ownership: "Pure helpers used across dashboard layers (no DOM, no state mutation).",
  },
  detectors: {
    name: "detectors",
    ownership: "Detector semantic ownership (pure semantic helpers, no orchestration).",
  },
  highlights: {
    name: "highlights",
    ownership: "Highlight engine + detector-owned highlight rules (DOM access allowed via injected ctx).",
  },
  rendering: {
    name: "rendering",
    ownership: "Markup generation via explicit render context (no DOM mutation; dashboardApp assigns).",
  },
  state: {
    name: "state",
    ownership: "Dashboard state container + explicit transitions + selectors (no DOM).",
  },
  actions: {
    name: "actions",
    ownership: "Action types/dispatcher/handlers for interaction orchestration (no markup generation).",
  },
  runtime: {
    name: "runtime",
    ownership: "Startup/hydration/history/render/iframe orchestration ownership modules.",
  },
  observability: {
    name: "observability",
    ownership: "DEV-only trace/lineage/snapshot helpers and in-memory forensic bus (no behavior changes).",
  },
  legacy: {
    name: "legacy",
    ownership: "Transitional layer (`src/legacy/dashboardApp.js`): temporarily allowed to depend on all layers.",
    transitional: true,
  },
  unknown: {
    name: "unknown",
    ownership: "Unclassified paths.",
  },
};

export { DASHBOARD_LAYERS };

