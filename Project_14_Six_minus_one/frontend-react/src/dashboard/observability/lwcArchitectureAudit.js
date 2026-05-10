function lwcArchitectureAuditEnabled() {
  return typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_LWC_ARCH_AUDIT === "1");
}

function logLwcArchitectureAudit(payload) {
  if (!lwcArchitectureAuditEnabled()) {
    return;
  }
  console.log("[LWC architecture audit]", payload);
}

function runLwcArchitectureAuditSnapshot({
  ruleId = "LCC-1",
  dimensionName = "Long Content Without Chunking",
  detectorRegistry,
  highlightRuleRegistry,
} = {}) {
  const semanticIntegrated = Boolean(detectorRegistry?.hasDetectorSemanticModule?.(ruleId));
  const highlightIntegrated = Boolean(highlightRuleRegistry?.hasHighlightRules?.(ruleId));

  const duplicated_modules = [];
  const inconsistent_contracts = [];

  if (!semanticIntegrated) {
    inconsistent_contracts.push("missing_detector_semantics_module");
    duplicated_modules.push("legacy/dashboardApp.js (LCC-1 semantics likely inline)");
  }
  if (!highlightIntegrated) {
    inconsistent_contracts.push("missing_highlight_rules_module");
    duplicated_modules.push("highlights/rules/sharedHighlightRules.js (fallbackSelectorsForIssue includes LCC-1)");
  }

  const snapshot = {
    stage: "snapshot",
    detector: "LWC",
    rule_id: ruleId,
    dimension: dimensionName,
    uses_shared_text_processing: true, // backend uses shared visible_text + tokenize_alpha_words; frontend does not re-count.
    uses_shared_grouping: false,
    uses_shared_preview_generation: false,
    uses_shared_highlight_engine: true, // generic engine exists; LCC-1 uses shared fallback rules, not detector-owned rules.
    registry_integrated: semanticIntegrated,
    duplicated_logic_detected: !semanticIntegrated || !highlightIntegrated,
    duplicated_modules,
    inconsistent_contracts,
    normalization_status: {
      locations_have_selector: "backend_sanitize_yes",
      highlight_scope: highlightIntegrated ? "registry" : "shared_fallback",
    },
  };

  logLwcArchitectureAudit(snapshot);
  return snapshot;
}

export {
  lwcArchitectureAuditEnabled,
  logLwcArchitectureAudit,
  runLwcArchitectureAuditSnapshot,
};

