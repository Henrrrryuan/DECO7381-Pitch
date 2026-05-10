function detectorEnablementAuditEnabled() {
  return typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_DETECTOR_ENABLEMENT_AUDIT === "1");
}

function auditLog(stage, detail = {}) {
  if (!detectorEnablementAuditEnabled()) {
    return;
  }
  console.log("[Detector enablement audit]", {
    stage,
    ...detail,
  });
}

function canonicalDimensionName(name) {
  return String(name || "");
}

function buildProfileDetectorMatrix({ PATIENT_PROFILES, DETECTOR_NAMES }) {
  const profiles = PATIENT_PROFILES || {};
  const detectorUniverse = Array.isArray(DETECTOR_NAMES) && DETECTOR_NAMES.length
    ? DETECTOR_NAMES.map(canonicalDimensionName)
    : Array.from(new Set(Object.values(profiles).flatMap((p) => (p?.enabledDetectors || []).map(canonicalDimensionName))));

  const matrix = {};
  Object.keys(profiles).forEach((profileName) => {
    const enabled = (profiles?.[profileName]?.enabledDetectors || []).map(canonicalDimensionName);
    const enabledSet = new Set(enabled);
    const disabled = detectorUniverse.filter((d) => !enabledSet.has(d));
    matrix[profileName] = {
      enabled,
      disabled,
      detectorUniverse,
    };
  });
  return matrix;
}

function auditDtEnablementDecision({
  stage,
  active_profile,
  detector,
  enabled,
  reason,
  source_of_truth,
  enabled_detectors,
  persisted_profile,
  hydrated_profile,
  onboarding_profile,
  runtime_profile,
  session_profile,
  fallback_profile,
} = {}) {
  auditLog(stage, {
    active_profile: String(active_profile || ""),
    detector: String(detector || ""),
    detector_rule_id: detector === "Dense Text Detection" ? "DT-1" : "",
    enabled: Boolean(enabled),
    reason: String(reason || ""),
    source_of_truth: String(source_of_truth || ""),
    enabled_detectors: Array.isArray(enabled_detectors) ? enabled_detectors : [],
    persisted_profile: persisted_profile || null,
    hydrated_profile: hydrated_profile || null,
    onboarding_profile: onboarding_profile || null,
    runtime_profile: runtime_profile || null,
    session_profile: session_profile || null,
    fallback_profile: fallback_profile || null,
  });
}

export {
  detectorEnablementAuditEnabled,
  auditLog,
  auditDtEnablementDecision,
  buildProfileDetectorMatrix,
};

