import {
  displayIssueCategoryName,
  getCognitiveDimensionLabel,
} from "./dashboardLabels.js";
import { getOrderedDimensionResults } from "./profileScoring.js";

// Assistant context builder.
//
// DashboardPage.jsx sends this compact structure to /assistant/chat. Keeping it
// separate from the chat component makes it clear which analysis fields are
// shared with the assistant.
export function buildAssistantContext(analysisResult, sourceName) {
  if (!analysisResult) {
    return null;
  }
  return {
    source_name: sourceName || "Uploaded file",
    overall_score: analysisResult.overall_score,
    weighted_average: analysisResult.weighted_average,
    min_dimension_score: analysisResult.min_dimension_score,
    profile_scores: analysisResult.profile_scores || [],
    dimensions: getOrderedDimensionResults(analysisResult).map((dimensionResult) => ({
      dimension: dimensionResult.dimension,
      issue_category_label: displayIssueCategoryName(dimensionResult.dimension),
      cognitive_dimension: getCognitiveDimensionLabel(dimensionResult.dimension),
      score: dimensionResult.score,
      issues: (dimensionResult.issues || []).map((issue) => ({
        rule_id: issue.rule_id,
        title: issue.title,
        description: issue.description,
        suggestion: issue.suggestion,
        severity: issue.severity,
      })),
    })),
  };
}
