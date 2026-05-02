// Backward-compatible Dashboard utility barrel.
//
// New Dashboard code should import from the focused files in utils/dashboard/.
// This file remains so older imports keep working while the migration is being
// reviewed by the team.
export * from "./dashboard/constants.js";
export * from "./dashboard/dashboardLabels.js";
export * from "./dashboard/dashboardSession.js";
export * from "./dashboard/profileScoring.js";
export * from "./dashboard/issueRecordIdentifiers.js";
export * from "./dashboard/issueRecords.js";
export * from "./dashboard/issueGuidance.js";
export * from "./dashboard/assistantContext.js";
export * from "./dashboard/previewHighlight.js";
