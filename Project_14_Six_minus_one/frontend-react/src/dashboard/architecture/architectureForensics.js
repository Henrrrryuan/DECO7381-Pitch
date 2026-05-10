function architectureForensicEnabled() {
  return typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_ARCHITECTURE_FORENSIC === "1");
}

function logArchitectureBoundary(details) {
  if (!architectureForensicEnabled()) {
    return;
  }
  console.log("[Architecture boundary]", details || {});
}

function logArchitectureDependency(details) {
  if (!architectureForensicEnabled()) {
    return;
  }
  console.log("[Architecture dependency]", details || {});
}

function logArchitectureViolation(details) {
  if (!architectureForensicEnabled()) {
    return;
  }
  console.warn("[Architecture violation]", details || {});
}

function validateDashboardArchitectureBoundaries({ relations = [] } = {}) {
  if (!architectureForensicEnabled()) {
    return { ok: true, violations: [] };
  }
  const violations = [];
  relations.forEach((relation) => {
    const result = relation?.result;
    if (result && result.ok === false) {
      violations.push(result);
      logArchitectureViolation({
        from: result.fromPath,
        to: result.toPath,
        fromLayer: result.fromLayer,
        toLayer: result.toLayer,
        reason: result.reason,
      });
    } else if (result && result.ok === true) {
      // Minimal visibility: only log allowed edges when explicitly enabled.
      logArchitectureDependency({
        from: result.fromPath,
        to: result.toPath,
        fromLayer: result.fromLayer,
        toLayer: result.toLayer,
        ok: true,
      });
    }
  });

  return { ok: violations.length === 0, violations };
}

export {
  architectureForensicEnabled,
  validateDashboardArchitectureBoundaries,
  logArchitectureBoundary,
  logArchitectureDependency,
  logArchitectureViolation,
};


