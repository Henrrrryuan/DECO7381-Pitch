import { DASHBOARD_DECLARED_RELATIONS } from "./runtimeBoundaries.js";
import { validateDashboardImportBoundary } from "./forbiddenImports.js";

function buildDeclaredRelationChecks() {
  return DASHBOARD_DECLARED_RELATIONS.map((edge) => {
    const fromPath = edge.from;
    const toPath = edge.to;
    const result = validateDashboardImportBoundary(fromPath, toPath);
    return { ...edge, result };
  });
}

export { buildDeclaredRelationChecks };

