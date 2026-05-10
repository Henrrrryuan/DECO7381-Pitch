// Declared (non-scanned) module relations for DEV boundary validation.
// This is intentionally lightweight and does not scan the filesystem.

const DASHBOARD_DECLARED_RELATIONS = [
  // legacy
  {
    from: "frontend-react/src/legacy/dashboardApp.js",
    to: "frontend-react/src/dashboard/runtime/dashboardRuntime.js",
  },
  {
    from: "frontend-react/src/legacy/dashboardApp.js",
    to: "frontend-react/src/dashboard/actions/dashboardActionDispatcher.js",
  },
  {
    from: "frontend-react/src/legacy/dashboardApp.js",
    to: "frontend-react/src/dashboard/rendering/renderers/detectorRenderer.js",
  },
  {
    from: "frontend-react/src/legacy/dashboardApp.js",
    to: "frontend-react/src/dashboard/highlights/engine/highlightEngine.js",
  },
  // runtime
  {
    from: "frontend-react/src/dashboard/runtime/dashboardBootstrap.js",
    to: "frontend-react/src/dashboard/runtime/dashboardHydrationRuntime.js",
  },
  {
    from: "frontend-react/src/dashboard/runtime/dashboardBootstrap.js",
    to: "frontend-react/src/dashboard/runtime/dashboardRenderRuntime.js",
  },
  // actions
  {
    from: "frontend-react/src/dashboard/actions/dashboardActionDispatcher.js",
    to: "frontend-react/src/dashboard/actions/dashboardActionRegistry.js",
  },
  // highlights
  {
    from: "frontend-react/src/dashboard/highlights/engine/highlightEngine.js",
    to: "frontend-react/src/dashboard/highlights/registry/highlightRuleRegistry.js",
  },
  {
    from: "frontend-react/src/dashboard/highlights/detectors/dtHighlightRules.js",
    to: "frontend-react/src/dashboard/detectors/dt/dtSemantics.js",
  },
  // rendering
  {
    from: "frontend-react/src/dashboard/rendering/renderers/issueRenderer.js",
    to: "frontend-react/src/dashboard/rendering/templates/issueTemplates.js",
  },
  {
    from: "frontend-react/src/dashboard/rendering/renderers/issueRenderer.js",
    to: "frontend-react/src/dashboard/rendering/context/renderContextBuilder.js",
  },
  // state
  {
    from: "frontend-react/src/dashboard/state/dashboardTransitions.js",
    to: "frontend-react/src/dashboard/state/dashboardStateForensics.js",
  },
];

export { DASHBOARD_DECLARED_RELATIONS };

