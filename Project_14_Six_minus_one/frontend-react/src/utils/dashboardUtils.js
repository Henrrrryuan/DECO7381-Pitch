export const DASHBOARD_HISTORY_CONTEXT_KEY = "cognilens.dashboard.history-context";
export const DASHBOARD_HISTORY_ONCE_KEY = "cognilens.dashboard.history-once";

const INFORMATION_OVERLOAD_NAME = "Information Overload";
const LEGACY_INFORMATION_OVERLOAD_NAME = "Visual Complexity";
const DIMENSION_DISPLAY_ORDER = [
  INFORMATION_OVERLOAD_NAME,
  "Readability",
  "Interaction & Distraction",
  "Consistency",
];
const PROFILE_DISPLAY_CONFIG = {
  "Reading Difficulties Lens": {
    label: "Dyslexia",
    subtitle: "Reading load sensitivity",
    weights: {
      [INFORMATION_OVERLOAD_NAME]: 0.35,
      Readability: 0.40,
      "Interaction & Distraction": 0.10,
      Consistency: 0.15,
    },
  },
  "Attention Regulation Lens": {
    label: "ADHD",
    subtitle: "Attention and distraction sensitivity",
    weights: {
      [INFORMATION_OVERLOAD_NAME]: 0.35,
      Readability: 0.10,
      "Interaction & Distraction": 0.35,
      Consistency: 0.20,
    },
  },
  "Autistic Support Lens": {
    label: "Autism",
    subtitle: "Predictability and sensory stability",
    weights: {
      [INFORMATION_OVERLOAD_NAME]: 0.20,
      Readability: 0.10,
      "Interaction & Distraction": 0.25,
      Consistency: 0.45,
    },
  },
};
const DIMENSION_CONFIG = [
  { name: INFORMATION_OVERLOAD_NAME, className: "visual" },
  { name: "Readability", className: "readability" },
  { name: "Interaction & Distraction", className: "interaction" },
  { name: "Consistency", className: "consistency" },
];
const SEVERITY_RANK = {
  critical: 3,
  major: 2,
  minor: 1,
};
const USER_LABELS_BY_RULE = {
  "IO-1": ["Dyslexia users", "ADHD users"],
  "IO-2": ["Dyslexia users", "ADHD users"],
  "IO-3": ["ADHD users", "Autistic users"],
  "IO-4": ["ADHD users", "Autistic users"],
  "IO-5": ["Dyslexia users", "ADHD users", "Autistic users"],
  "RD-1": ["Dyslexia users"],
  "RD-2": ["Dyslexia users", "ADHD users"],
  "RD-3": ["Dyslexia users", "ADHD users", "Autistic users"],
  "RD-4": ["Dyslexia users"],
  "RD-5": ["Dyslexia users", "ADHD users", "Autistic users"],
  "RD-6": ["Dyslexia users", "ADHD users"],
  "ID-1": ["ADHD users", "Autistic users"],
  "ID-2": ["ADHD users", "Autistic users"],
  "ID-3": ["ADHD users", "Autistic users"],
  "CS-1": ["Dyslexia users", "Autistic users"],
  "CS-2": ["ADHD users", "Autistic users"],
  "CS-3": ["ADHD users", "Autistic users"],
  "CS-4": ["Dyslexia users", "ADHD users", "Autistic users"],
  "CS-5": ["ADHD users", "Autistic users"],
  "CS-6": ["ADHD users", "Autistic users"],
  "CS-7": ["Dyslexia users", "ADHD users", "Autistic users"],
  "CS-8": ["ADHD users", "Autistic users"],
};
const COGNITIVE_OBJECTIVES_BY_RULE = {
  "IO-1": "Help Users Focus",
  "IO-2": "Help Users Focus",
  "IO-3": "Help Users Focus",
  "IO-4": "Help Users Focus",
  "IO-5": "Help Users Find What They Need",
  "RD-1": "Use Clear and Understandable Content",
  "RD-2": "Use Clear and Understandable Content",
  "RD-3": "Help Users Understand What Things are and How to Use Them",
  "RD-4": "Use Clear and Understandable Content",
  "RD-5": "Use Clear and Understandable Content",
  "RD-6": "Use Clear and Understandable Content",
  "ID-1": "Support Adaptation and Personalization",
  "ID-2": "Support Adaptation and Personalization",
  "ID-3": "Help Users Focus",
  "CS-1": "Help Users Understand What Things are and How to Use Them",
  "CS-2": "Help Users Find What They Need",
  "CS-3": "Ensure Processes Do Not Rely on Memory",
  "CS-4": "Help Users Understand What Things are and How to Use Them",
  "CS-5": "Help Users Find What They Need",
  "CS-6": "Help Users Find What They Need",
  "CS-7": "Help Users Understand What Things are and How to Use Them",
  "CS-8": "Help Users Understand What Things are and How to Use Them",
};
const ISO_CLAUSES_BY_RULE = {
  "IO-1": ["6.3.3 Human effort expended", "6.4.3 Cognitive responses"],
  "IO-2": ["6.3.3 Human effort expended"],
  "IO-3": ["6.4.3 Cognitive responses", "6.4.4 Emotional responses"],
  "IO-4": ["6.2.1 Effectiveness general", "6.3.3 Human effort expended"],
  "IO-5": ["6.2.2 Accuracy", "6.3.3 Human effort expended"],
  "RD-1": ["6.2.2 Accuracy"],
  "RD-2": ["6.3.2 Time used", "6.3.3 Human effort expended"],
  "RD-3": ["6.2.2 Accuracy"],
  "RD-4": ["6.2.2 Accuracy", "6.4.3 Cognitive responses"],
  "RD-5": ["6.2.3 Completeness"],
  "RD-6": ["6.3.3 Human effort expended"],
  "ID-1": ["6.4.2 Physical responses", "6.4.4 Emotional responses"],
  "ID-2": ["6.4.2 Physical responses", "6.4.3 Cognitive responses"],
  "ID-3": ["6.2.3 Completeness", "6.4.4 Emotional responses"],
  "CS-1": ["6.3.3 Human effort expended"],
  "CS-2": ["6.2.2 Accuracy"],
  "CS-3": ["6.2.3 Completeness", "6.3.3 Human effort expended"],
  "CS-4": ["6.2.2 Accuracy"],
  "CS-5": ["6.3.2 Time used", "6.3.3 Human effort expended"],
  "CS-6": ["6.3.2 Time used"],
  "CS-7": ["6.2.2 Accuracy"],
  "CS-8": ["6.2.2 Accuracy", "6.3.3 Human effort expended"],
};
const HIGHLIGHT_SETTINGS_BY_DIMENSION = {
  [INFORMATION_OVERLOAD_NAME]: {
    color: "#df3e53",
    selectors: [
      "main",
      "section",
      "article",
      "aside",
      "nav",
      "header",
      "h1",
      "h2",
      "button",
      "a",
      ".card",
      "[class*='card' i]",
      "[class*='grid' i]",
      "[class*='banner' i]",
      "[class*='sidebar' i]",
      "[class*='cta' i]",
      "[class*='hero' i]",
    ],
  },
  Readability: {
    color: "#2493dd",
    selectors: ["p", "li", "article", "section p", "button", "a"],
  },
  "Interaction & Distraction": {
    color: "#f0c400",
    selectors: [
      "dialog",
      "[role='dialog']",
      "[aria-modal='true']",
      "[aria-live]",
      "video",
      "audio",
      "iframe",
      "[autoplay]",
      "[class*='modal' i]",
      "[class*='popup' i]",
      "[class*='overlay' i]",
      "[class*='toast' i]",
      "[class*='chat' i]",
    ],
  },
  Consistency: {
    color: "#8d28df",
    selectors: [
      "h1",
      "h2",
      "h3",
      "nav",
      "header",
      "form",
      "label",
      "button",
      "a",
      "input",
      "select",
      "textarea",
      "[class*='nav' i]",
      "[class*='menu' i]",
      "[class*='step' i]",
      "[class*='breadcrumb' i]",
    ],
  },
};

// Utility functions shared by the Vite Dashboard page.
//
// DashboardPage.jsx uses these helpers to read the Report ID from the URL,
// convert backend history detail into dashboard-ready data, and calculate the
// small display values used by the sidebar components.

export function getHistoryReportRunIdentifierFromUrl() {
  const searchParameters = new URLSearchParams(window.location.search);
  const explicitRunIdentifier = searchParameters.get("run") || "";
  if (searchParameters.get("from") === "history" && explicitRunIdentifier) {
    return explicitRunIdentifier;
  }

  try {
    return sessionStorage.getItem(DASHBOARD_HISTORY_CONTEXT_KEY) || "";
  } catch (_) {
    return "";
  }
}

export function buildDashboardSessionFromReportDetail(dashboardReportDetail) {
  const sourceName = dashboardReportDetail.run?.source_name || "history-item";
  const analysisPayload = dashboardReportDetail.analysis || dashboardReportDetail.result || {};
  return {
    current: {
      payload: {
        ...analysisPayload,
        run: dashboardReportDetail.run || analysisPayload?.run,
        resource_bundle: dashboardReportDetail.resource_bundle || analysisPayload?.resource_bundle || null,
        html_content: dashboardReportDetail.html_content || analysisPayload?.html_content || "",
      },
      html: dashboardReportDetail.html_content || analysisPayload?.html_content || "",
      sourceName,
      sourceUrl: isProbablyWebsiteAddress(sourceName) ? sourceName : "",
    },
    previous: null,
  };
}

export function normalizeDashboardSession(rawDashboardSession) {
  if (!rawDashboardSession?.current?.payload) {
    return null;
  }

  const currentPayload = rawDashboardSession.current.payload;
  const sourceName = rawDashboardSession.current.sourceName
    || rawDashboardSession.sourceName
    || currentPayload?.run?.source_name
    || "Uploaded file";
  return {
    current: {
      payload: currentPayload,
      html: rawDashboardSession.current.html || rawDashboardSession.html || currentPayload.html_content || "",
      sourceName,
      sourceType: rawDashboardSession.current.sourceType || "",
      sourceUrl: rawDashboardSession.current.sourceUrl || rawDashboardSession.sourceUrl || (isProbablyWebsiteAddress(sourceName) ? sourceName : ""),
      savedAt: rawDashboardSession.current.savedAt || rawDashboardSession.savedAt || "",
    },
    previous: rawDashboardSession.previous || null,
    html: rawDashboardSession.html || rawDashboardSession.current.html || "",
    sourceName,
    sourceUrl: rawDashboardSession.sourceUrl || rawDashboardSession.current.sourceUrl || "",
    savedAt: rawDashboardSession.savedAt || rawDashboardSession.current.savedAt || "",
  };
}

export function buildAnalysisView(analysisPayload) {
  return {
    overall_score: analysisPayload?.overall_score,
    weighted_average: analysisPayload?.weighted_average,
    min_dimension_score: analysisPayload?.min_dimension_score,
    dimensions: analysisPayload?.dimensions || [],
    profile_scores: analysisPayload?.profile_scores || [],
    visual_complexity: analysisPayload?.visual_complexity || null,
  };
}

export function formatReportTimestamp(value) {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }
  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");
  const hour = String(parsedDate.getHours()).padStart(2, "0");
  const minute = String(parsedDate.getMinutes()).padStart(2, "0");
  const second = String(parsedDate.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hour}${minute}${second}`;
}

export function displayDimensionName(dimensionName) {
  return dimensionName === LEGACY_INFORMATION_OVERLOAD_NAME
    ? INFORMATION_OVERLOAD_NAME
    : dimensionName;
}

export function canonicalDimensionName(dimensionName) {
  return displayDimensionName(dimensionName);
}

export function displayIssueCategoryName(dimensionName) {
  const normalizedDimensionName = displayDimensionName(dimensionName);
  if (normalizedDimensionName === INFORMATION_OVERLOAD_NAME) {
    return "Information Overload Issue";
  }
  if (normalizedDimensionName === "Readability") {
    return "Readability Issue";
  }
  if (normalizedDimensionName === "Interaction & Distraction") {
    return "Interaction & Distraction Issue";
  }
  if (normalizedDimensionName === "Consistency") {
    return "Consistency & Predictability Issue";
  }
  return `${normalizedDimensionName} Issue`;
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

export function displayProfileName(profileName) {
  return getProfileDisplayMeta(profileName).label;
}

export function getProfileDisplayMeta(profileName) {
  const profileMeta = PROFILE_DISPLAY_CONFIG[profileName];
  if (profileMeta) {
    return profileMeta;
  }
  return {
    label: normalizeProfileLabel(profileName),
    subtitle: "Audience lens",
    weights: {},
  };
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

export function normalizedScore(scoreValue) {
  return Math.max(0, Math.min(100, Number(scoreValue) || 0));
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
  // The backend returns raw dimension scores. The frontend then adjusts those
  // scores for the selected audience lens so the sidebar risk badges can show
  // which dimensions matter most for Dyslexia, ADHD, or Autism.
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
  // Converts backend profile_scores into the tab data used by ProfileScores.jsx.
  //
  // DashboardPage.jsx uses the selected slide to feed dynamic dimension scores
  // into DashboardSidebar.jsx and DimensionBars.jsx.
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

export function isProbablyWebsiteAddress(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

export function buildIssueIdentifier(dimensionName, ruleIdentifier, issueIndex = 0) {
  return `${displayDimensionName(dimensionName)}::${ruleIdentifier || `issue-${issueIndex + 1}`}`;
}

export function getAllIssueRecords(analysisResult, activeProfileLabel = "") {
  const activeUserGroup = normalizeProfileLabel(activeProfileLabel);
  const records = [];
  getOrderedDimensionResultsForProfile(analysisResult, activeUserGroup).forEach((dimensionResult) => {
    prioritizedIssuesForProfile(dimensionResult).forEach((issue, issueIndex) => {
      if (!issueMatchesActiveProfile(issue, activeUserGroup)) {
        return;
      }
      records.push({
        dimensionResult,
        issue,
        issueNumber: records.length + 1,
        issueIdentifier: buildIssueIdentifier(dimensionResult.dimension, issue.rule_id, issueIndex),
      });
    });
  });
  return records;
}

export function findIssueRecordByIdentifier(analysisResult, issueIdentifier, activeProfileLabel = "") {
  return getAllIssueRecords(analysisResult, activeProfileLabel)
    .find((issueRecord) => issueRecord.issueIdentifier === issueIdentifier) || null;
}

export function normalizeProfileLabel(profileLabel) {
  const text = String(profileLabel || "").toLowerCase();
  if (text.includes("adhd") || text.includes("attention")) {
    return "ADHD";
  }
  if (text.includes("autism") || text.includes("autistic")) {
    return "Autism";
  }
  return "Dyslexia";
}

export function getActiveProfileLabel(profileScoreItems, activeProfileIndex) {
  const profileItem = profileScoreItems?.[activeProfileIndex] || profileScoreItems?.[0] || null;
  return normalizeProfileLabel(profileItem?.profile || profileItem?.label || profileItem?.name || "");
}

export function issueMatchesActiveProfile(issue, activeProfileLabel) {
  const activeUserGroup = normalizeProfileLabel(activeProfileLabel);
  const affectedUsers = USER_LABELS_BY_RULE[issue?.rule_id] || ["Dyslexia users", "ADHD users", "Autistic users"];
  return affectedUsers.some((userLabel) => normalizeProfileLabel(userLabel) === activeUserGroup);
}

function issueEvidenceNumber(issue, evidenceKey) {
  return Number(issue?.evidence?.[evidenceKey]) || 0;
}

function issuePriority(issue, dimensionName = "") {
  if (canonicalDimensionName(dimensionName) === INFORMATION_OVERLOAD_NAME) {
    return (
      (issue?.evidence?.blocks_primary_task ? 400 : 0)
      + (issueEvidenceNumber(issue, "confusion_distraction_level") * 100)
      + (issueEvidenceNumber(issue, "cumulative_load_level") * 10)
      + (issue?.penalty || 0)
    );
  }
  return (SEVERITY_RANK[issue?.severity] || 0) * 100 + (issue?.penalty || 0);
}

export function prioritizedIssuesForProfile(dimensionResult) {
  // Sorts issue cards the same way as the old dashboard app.js.
  //
  // DashboardSidebar.jsx calls getAllIssueRecords(), which uses this function
  // before rendering IssueSummaryCard.jsx. Higher priority issues appear first
  // inside the Top Issue Cards accordion for the selected audience lens.
  return [...(dimensionResult?.issues || [])].sort((firstIssue, secondIssue) => {
    const priorityDifference = issuePriority(secondIssue, dimensionResult?.dimension)
      - issuePriority(firstIssue, dimensionResult?.dimension);
    if (priorityDifference !== 0) {
      return priorityDifference;
    }
    const elementCountDifference = issueFailingElementCount(secondIssue) - issueFailingElementCount(firstIssue);
    if (elementCountDifference !== 0) {
      return elementCountDifference;
    }
    return String(firstIssue?.title || firstIssue?.rule_id || "")
      .localeCompare(String(secondIssue?.title || secondIssue?.rule_id || ""));
  });
}

export function conciseText(text, fallbackText = "", maximumLength = 140) {
  const normalizedText = String(text || fallbackText || "").replace(/\s+/g, " ").trim();
  if (normalizedText.length <= maximumLength) {
    return normalizedText;
  }
  return `${normalizedText.slice(0, Math.max(0, maximumLength - 3)).trim()}...`;
}

export function getCognitiveDimensionLabel(dimensionName) {
  const displayName = displayDimensionName(dimensionName);
  if (displayName === INFORMATION_OVERLOAD_NAME) {
    return "Information Filtering / Visual Prioritisation";
  }
  if (displayName === "Readability") {
    return "Reading Load / Comprehension";
  }
  if (displayName === "Interaction & Distraction") {
    return "Attention Regulation / Task Continuity";
  }
  if (displayName === "Consistency") {
    return "Predictability / Wayfinding";
  }
  return "Cognitive accessibility";
}

export function displayIssueCategorySingular(issue, dimensionName) {
  const rulePrefix = String(issue?.rule_id || "").split("-")[0];
  if (rulePrefix === "RD") {
    return "Readability Issue";
  }
  if (rulePrefix === "ID") {
    return "Interaction & Distraction Issue";
  }
  if (rulePrefix === "CS") {
    return "Consistency & Predictability Issue";
  }
  return displayDimensionName(dimensionName) === "Readability"
    ? "Readability Issue"
    : displayDimensionName(dimensionName) === "Interaction & Distraction"
      ? "Interaction & Distraction Issue"
      : displayDimensionName(dimensionName) === "Consistency"
        ? "Consistency & Predictability Issue"
        : "Information Overload Issue";
}

export function issueFailingElementCount(issue) {
  const locations = Array.isArray(issue?.locations) ? issue.locations : [];
  return Math.max(1, locations.length || 0);
}

export function issueAffectedUserTags(ruleIdentifier) {
  return USER_LABELS_BY_RULE[ruleIdentifier] || ["Dyslexia users", "ADHD users", "Autistic users"];
}

export function issueIsoClauseTags(ruleIdentifier) {
  return ISO_CLAUSES_BY_RULE[ruleIdentifier] || ["6.3.3 Human effort expended"];
}

export function issueCognitiveObjective(ruleIdentifier) {
  return COGNITIVE_OBJECTIVES_BY_RULE[ruleIdentifier] || "Help Users Focus";
}

export function frameworkMappingCopy(ruleIdentifier) {
  const objective = issueCognitiveObjective(ruleIdentifier);
  return {
    coga: `COGA Objective: ${objective}`,
    iso: `ISO 9241-11: ${issueIsoClauseTags(ruleIdentifier).join("; ")}`,
    wcag: `Cognitive Accessibility Guidance: ${objective}`,
  };
}

export function recommendedFixSteps(issue, dimensionName) {
  const ruleIdentifier = issue?.rule_id || "";
  const displayName = displayDimensionName(dimensionName);
  if (ruleIdentifier.startsWith("RD") || displayName === "Readability") {
    return [
      { priority: "Must", text: "Rewrite the affected text into shorter, single-idea sentences." },
      { priority: "Should", text: "Replace dense or specialist wording with familiar terms where possible." },
      { priority: "Could", text: "Use headings, bullets, or spacing so readers can scan before reading in full." },
    ];
  }
  if (ruleIdentifier.startsWith("ID") || displayName === "Interaction & Distraction") {
    return [
      { priority: "Must", text: "Remove automatic interruptions, autoplay, or motion that starts before users choose it." },
      { priority: "Should", text: "Make overlays, chat prompts, and secondary actions user-triggered where possible." },
      { priority: "Could", text: "Keep the primary task visible and stable while users are reading or deciding." },
    ];
  }
  if (ruleIdentifier.startsWith("CS") || displayName === "Consistency") {
    return [
      { priority: "Must", text: "Use consistent headings, labels, and navigation patterns across related sections." },
      { priority: "Should", text: "Make the next step predictable before asking users to act." },
      { priority: "Could", text: "Avoid sudden layout or wording changes that force users to re-orient." },
    ];
  }
  return [
    { priority: "Must", text: "Choose one primary reading path or task for this area." },
    { priority: "Should", text: "Demote secondary banners, panels, media, or actions that compete with the main path." },
    { priority: "Could", text: "Use Show highlighted location to check the highlighted areas after redesigning the layout." },
  ];
}

export function issueGoalText(issue, dimensionName) {
  const displayName = displayDimensionName(dimensionName);
  if (displayName === "Readability") {
    return "Keep sentences easy to scan, with one clear message per line.";
  }
  if (displayName === "Interaction & Distraction") {
    return "Keep only essential motion and keep users in control of interruptions.";
  }
  if (displayName === "Consistency") {
    return "Make navigation and next actions predictable across the page.";
  }
  return "Reduce competing focal points and support one dominant task path.";
}

export function issueDoneWhenText(issue, dimensionName) {
  const displayName = displayDimensionName(dimensionName);
  if (displayName === "Readability") {
    return "Done when key passages are short, clear, and scannable without re-reading.";
  }
  if (displayName === "Interaction & Distraction") {
    return "Done when non-essential autoplay or pop-up interruptions are removed.";
  }
  if (displayName === "Consistency") {
    return "Done when repeated UI patterns use consistent labels and interaction flow.";
  }
  return "Done when one clear primary focus is visible above the fold.";
}

export function locationPrimaryText(location) {
  return location?.text
    || location?.preview
    || location?.sentence_preview
    || location?.label
    || location?.summary
    || location?.region
    || location?.html_snippet
    || location?.selector
    || "";
}

export function friendlyLocationLabel(location) {
  const technicalText = location?.summary || location?.region || location?.selector || location?.tag || "";
  if (technicalText) {
    return conciseText(
      String(technicalText).replace(/^[.#]/, "").replace(/[-_]+/g, " "),
      "Affected page area",
      72,
    );
  }
  return conciseText(locationPrimaryText(location), "Affected page area", 72);
}

export function locationMetaText(location) {
  if (location?.summary) {
    return `Location: ${location.summary}`;
  }
  if (location?.region) {
    return `Region: ${location.region}`;
  }
  if (location?.tag) {
    return `Element type: ${location.tag}`;
  }
  if (location?.selector) {
    return `Selector: ${location.selector}`;
  }
  return "Location detail";
}

export function getKeyLocations(issue, limit = 3) {
  const seenLabels = new Set();
  return (Array.isArray(issue?.locations) ? issue.locations : [])
    .map((location) => ({ location, label: friendlyLocationLabel(location) }))
    .filter(({ label }) => {
      const normalizedLabel = label.toLowerCase();
      if (seenLabels.has(normalizedLabel)) {
        return false;
      }
      seenLabels.add(normalizedLabel);
      return true;
    })
    .slice(0, limit);
}

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

export function buildPreviewHtml(htmlContent) {
  const baseMarkup = "\n<base href=\"about:srcdoc\">\n";
  const source = String(htmlContent || "");
  if (/<head[\s>]/i.test(source)) {
    return source.replace(/<head([^>]*)>/i, `<head$1>${baseMarkup}`);
  }
  return `${baseMarkup}${source}`;
}

export function getPreviewFrameAddress(sourceUrl) {
  return isProbablyWebsiteAddress(sourceUrl)
    ? `/eye/proxy?url=${encodeURIComponent(sourceUrl)}`
    : "";
}

export function getHighlightSettings(dimensionName) {
  return HIGHLIGHT_SETTINGS_BY_DIMENSION[displayDimensionName(dimensionName)]
    || HIGHLIGHT_SETTINGS_BY_DIMENSION[INFORMATION_OVERLOAD_NAME];
}

export function getFallbackSelectorsForIssue(issue, dimensionName) {
  const ruleIdentifier = issue?.rule_id || "";
  if (ruleIdentifier === "IO-1") {
    return ["main > *", "header > *", "section", "article", "nav", "button", "a", "img", "h1", "h2"];
  }
  if (ruleIdentifier === "IO-2") {
    return ["section", "article", "ul", "ol", ".card", "[class*='card' i]", "[class*='grid' i]"];
  }
  if (ruleIdentifier === "IO-3") {
    return ["aside", "[class*='sidebar' i]", "[class*='banner' i]", "[class*='promo' i]", "[class*='support' i]"];
  }
  if (ruleIdentifier === "IO-4") {
    return ["button", "a", "[role='button']", "[class*='cta' i]", "[class*='primary' i]", "[class*='hero' i]", "[class*='btn' i]"];
  }
  if (ruleIdentifier.startsWith("RD")) {
    return ["p", "li", "article", "section", "label", "legend", "small", "button", "a"];
  }
  if (ruleIdentifier.startsWith("ID")) {
    return HIGHLIGHT_SETTINGS_BY_DIMENSION["Interaction & Distraction"].selectors;
  }
  if (ruleIdentifier.startsWith("CS")) {
    return HIGHLIGHT_SETTINGS_BY_DIMENSION.Consistency.selectors;
  }
  return getHighlightSettings(dimensionName).selectors;
}
