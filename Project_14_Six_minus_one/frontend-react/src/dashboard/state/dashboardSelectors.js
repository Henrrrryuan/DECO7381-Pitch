function activePatientProfile(state, PATIENT_PROFILES) {
  return PATIENT_PROFILES?.[state.activeProfile] || PATIENT_PROFILES?.General || PATIENT_PROFILES?.Alison || null;
}

function selectedIssueRecord(state) {
  if (!state.selectedIssueId || !state.currentResult) {
    return null;
  }
  const [dimensionName, ruleId] = String(state.selectedIssueId).split(":");
  if (!dimensionName || !ruleId) {
    return null;
  }
  const dimension = (state.currentResult.dimensions || []).find((item) => item.dimension === dimensionName);
  const issue = dimension?.issues?.find((item) => item.rule_id === ruleId);
  return issue ? { dimension, issue } : null;
}

export { activePatientProfile, selectedIssueRecord };

