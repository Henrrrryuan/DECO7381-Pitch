import { detectDashboardLayerFromPath, dependencyViolationReason, isDependencyAllowed } from "./dependencyGraph.js";

function validateDashboardImportBoundary(fromPath, toPath) {
  const fromLayer = detectDashboardLayerFromPath(fromPath);
  const toLayer = detectDashboardLayerFromPath(toPath);
  const allowed = isDependencyAllowed(fromLayer, toLayer);
  return {
    ok: allowed,
    fromPath: String(fromPath || ""),
    toPath: String(toPath || ""),
    fromLayer,
    toLayer,
    reason: allowed ? "" : dependencyViolationReason(fromLayer, toLayer),
  };
}

function summarizeBoundaryViolation(result) {
  if (!result || result.ok) {
    return "";
  }
  return `${result.reason} [from=${result.fromLayer}] ${result.fromPath} -> [to=${result.toLayer}] ${result.toPath}`;
}

export { summarizeBoundaryViolation, validateDashboardImportBoundary };

