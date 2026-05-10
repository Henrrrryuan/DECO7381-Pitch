import { DASHBOARD_DEPENDENCY_RULES } from "./dependencyRules.js";

function detectDashboardLayerFromPath(path) {
  const value = String(path || "");

  if (value.includes("/src/legacy/") || value.startsWith("frontend-react/src/legacy/")) {
    return "legacy";
  }

  const absMarker = "/src/dashboard/";
  const absIdx = value.indexOf(absMarker);
  if (absIdx !== -1) {
    const remainder = value.slice(absIdx + absMarker.length);
    const top = remainder.split("/")[0] || "";
    return normalizeDashboardLayerFromTopFolder(top);
  }

  const relMarker = "frontend-react/src/dashboard/";
  const relIdx = value.indexOf(relMarker);
  if (relIdx !== -1) {
    const remainder = value.slice(relIdx + relMarker.length);
    const top = remainder.split("/")[0] || "";
    return normalizeDashboardLayerFromTopFolder(top);
  }

  return "unknown";
}

function normalizeDashboardLayerFromTopFolder(top) {
  const known = new Set(["detectors", "highlights", "rendering", "runtime", "state", "actions", "shared", "architecture", "observability"]);
  if (!top || !known.has(top)) {
    return "unknown";
  }
  if (top === "architecture" || top === "observability") {
    return "shared";
  }
  return top;
}

function isDependencyAllowed(fromLayer, toLayer) {
  if (!fromLayer || !toLayer) {
    return false;
  }
  if (fromLayer === "unknown" || toLayer === "unknown") {
    return false;
  }
  if (fromLayer === toLayer) {
    return true;
  }
  const rules = DASHBOARD_DEPENDENCY_RULES[fromLayer];
  const allowed = rules?.allowed || [];
  return allowed.includes(toLayer);
}

function dependencyViolationReason(fromLayer, toLayer) {
  if (fromLayer === "unknown" || toLayer === "unknown") {
    return "unknown layer (path not classified)";
  }
  if (fromLayer === toLayer) {
    return "";
  }
  const rules = DASHBOARD_DEPENDENCY_RULES[fromLayer];
  const allowed = rules?.allowed || [];
  return `forbidden dependency: ${fromLayer} → ${toLayer} (allowed: ${allowed.join(", ") || "none"})`;
}

export { detectDashboardLayerFromPath, dependencyViolationReason, isDependencyAllowed };

