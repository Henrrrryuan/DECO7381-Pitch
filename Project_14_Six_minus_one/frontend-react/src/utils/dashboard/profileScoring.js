import {
  DIMENSION_CONFIG,
  DIMENSION_DISPLAY_ORDER,
  INFORMATION_OVERLOAD_NAME,
  LEGACY_INFORMATION_OVERLOAD_NAME,
} from "./constants.js";
import {
  canonicalDimensionName,
  displayDimensionName,
  displayProfileName,
  getProfileDisplayMeta,
  normalizeProfileLabel,
} from "./dashboardLabels.js";

// Profile scoring helpers.
//
// DashboardPage.jsx uses these functions to turn backend dimension scores into
// the profile-weighted values shown for Dyslexia, ADHD, and Autism. Components
// receive the finished values and only render them.
export function normalizedScore(scoreValue) {
  return Math.max(0, Math.min(100, Number(scoreValue) || 0));
}

export function riskMetaFromScore(scoreValue) {
  const riskIndex = 100 - normalizedScore(scoreValue);
  if (riskIndex <= 25) {
    return { level: "Low risk", className: "risk-low" };
  }
  if (riskIndex <= 60) {
    return { level: "Medium risk", className: "risk-medium" };
  }
  return { level: "High risk", className: "risk-high" };
}

export function getTotalIssueCount(analysisResult) {
  return (analysisResult?.dimensions || []).reduce(
    (totalIssueCount, dimensionResult) => totalIssueCount + (dimensionResult.issues || []).length,
    0,
  );
}

export function getOrderedDimensionResults(analysisResult) {
  return [...(analysisResult?.dimensions || [])].sort((firstDimension, secondDimension) => {
    const firstDimensionIndex = DIMENSION_DISPLAY_ORDER.indexOf(displayDimensionName(firstDimension.dimension));
    const secondDimensionIndex = DIMENSION_DISPLAY_ORDER.indexOf(displayDimensionName(secondDimension.dimension));
    const normalizedFirstIndex = firstDimensionIndex === -1 ? Number.MAX_SAFE_INTEGER : firstDimensionIndex;
    const normalizedSecondIndex = secondDimensionIndex === -1 ? Number.MAX_SAFE_INTEGER : secondDimensionIndex;
    return normalizedFirstIndex - normalizedSecondIndex;
  });
}

export function findDimensionResult(analysisResult, dimensionName) {
  const acceptedNames = canonicalDimensionName(dimensionName) === INFORMATION_OVERLOAD_NAME
    ? [INFORMATION_OVERLOAD_NAME, LEGACY_INFORMATION_OVERLOAD_NAME]
    : [dimensionName];
  return (analysisResult?.dimensions || []).find((dimensionResult) => (
    acceptedNames.includes(dimensionResult.dimension)
  )) || null;
}

function dimensionBaseOrderIndex(dimensionName) {
  const dimensionIndex = DIMENSION_DISPLAY_ORDER.indexOf(canonicalDimensionName(dimensionName));
  return dimensionIndex === -1 ? Number.MAX_SAFE_INTEGER : dimensionIndex;
}

export function compareDimensionEntriesByRisk(firstDimensionEntry, secondDimensionEntry) {
  const scoreDifference = normalizedScore(firstDimensionEntry?.score) - normalizedScore(secondDimensionEntry?.score);
  if (scoreDifference !== 0) {
    return scoreDifference;
  }
  const issueCountDifference = (secondDimensionEntry?.issueCount || 0) - (firstDimensionEntry?.issueCount || 0);
  if (issueCountDifference !== 0) {
    return issueCountDifference;
  }
  return dimensionBaseOrderIndex(firstDimensionEntry?.name) - dimensionBaseOrderIndex(secondDimensionEntry?.name);
}

export function profileSourceNameForLabel(analysisResult, profileLabel) {
  return (analysisResult?.profile_scores || []).find((profileScoreItem) => (
    displayProfileName(profileScoreItem.name) === normalizeProfileLabel(profileLabel)
  ))?.name || profileLabel;
}

export function buildProfileDimensionEntries(analysisResult, profileName) {
  // Recreates the old dashboard app.js lens calculation in React.
  //
  // The backend returns raw dimension scores. The frontend adjusts those scores
  // for the selected audience lens so the sidebar risk badges can show which
  // dimensions matter most for Dyslexia, ADHD, or Autism.
  if (!analysisResult?.dimensions?.length) {
    return [];
  }

  const profileWeights = getProfileDisplayMeta(profileName).weights || {};
  return DIMENSION_CONFIG.map(({ name, className }) => {
    const dimensionResult = findDimensionResult(analysisResult, name);
    const rawScore = dimensionResult ? dimensionResult.score : 0;
    const issueCount = dimensionResult?.issues?.length || 0;
    const profileWeight = profileWeights[canonicalDimensionName(name)] ?? 0.25;
    const sensitivityMultiplier = profileWeight / 0.25;
    const adjustedScore = normalizedScore(Math.round(100 - ((100 - rawScore) * sensitivityMultiplier)));
    return {
      name,
      className,
      score: adjustedScore,
      issueCount,
      dimensionResult,
    };
  });
}

export function buildScoreSlides(analysisResult) {
  return (analysisResult?.profile_scores || []).map((profileScoreItem) => {
    const profileMeta = getProfileDisplayMeta(profileScoreItem.name);
    return {
      label: profileMeta.label,
      sourceName: profileScoreItem.name,
      score: profileScoreItem.score,
      summary: profileScoreItem.summary,
      dimensionEntries: buildProfileDimensionEntries(analysisResult, profileScoreItem.name),
    };
  });
}

export function getActiveProfileDimensionEntries(analysisResult, activeProfileLabel) {
  const profileSourceName = profileSourceNameForLabel(analysisResult, activeProfileLabel);
  return buildProfileDimensionEntries(analysisResult, profileSourceName)
    .sort(compareDimensionEntriesByRisk);
}

export function activeProfileDimensionScoreMap(analysisResult, activeProfileLabel) {
  const scoreMap = new Map();
  getActiveProfileDimensionEntries(analysisResult, activeProfileLabel).forEach((dimensionEntry) => {
    scoreMap.set(canonicalDimensionName(dimensionEntry.name), normalizedScore(dimensionEntry.score));
  });
  return scoreMap;
}

export function compareDimensionsByActiveProfileRisk(firstDimensionResult, secondDimensionResult, scoreMap) {
  const firstDimensionScore = scoreMap.get(canonicalDimensionName(firstDimensionResult?.dimension));
  const secondDimensionScore = scoreMap.get(canonicalDimensionName(secondDimensionResult?.dimension));
  const scoreDifference = (
    Number.isFinite(firstDimensionScore) ? firstDimensionScore : normalizedScore(firstDimensionResult?.score)
  ) - (
    Number.isFinite(secondDimensionScore) ? secondDimensionScore : normalizedScore(secondDimensionResult?.score)
  );
  if (scoreDifference !== 0) {
    return scoreDifference;
  }
  const issueCountDifference = (secondDimensionResult?.issues?.length || 0) - (firstDimensionResult?.issues?.length || 0);
  if (issueCountDifference !== 0) {
    return issueCountDifference;
  }
  return dimensionBaseOrderIndex(firstDimensionResult?.dimension) - dimensionBaseOrderIndex(secondDimensionResult?.dimension);
}

export function getOrderedDimensionResultsForProfile(analysisResult, activeProfileLabel) {
  const scoreMap = activeProfileDimensionScoreMap(analysisResult, activeProfileLabel);
  return [...(analysisResult?.dimensions || [])].sort((firstDimensionResult, secondDimensionResult) => (
    compareDimensionsByActiveProfileRisk(firstDimensionResult, secondDimensionResult, scoreMap)
  ));
}

export function getActiveProfileLabel(profileScoreItems, activeProfileIndex) {
  const profileItem = profileScoreItems?.[activeProfileIndex] || profileScoreItems?.[0] || null;
  return normalizeProfileLabel(profileItem?.profile || profileItem?.label || profileItem?.name || "");
}
