import {
  INFORMATION_OVERLOAD_NAME,
  SEVERITY_RANK,
  USER_LABELS_BY_RULE,
} from "./constants.js";
import {
  buildIssueIdentifier,
} from "./issueRecordIdentifiers.js";
import {
  canonicalDimensionName,
  displayDimensionName,
  normalizeProfileLabel,
} from "./dashboardLabels.js";
import { issueFailingElementCount } from "./issueGuidance.js";
import { getOrderedDimensionResultsForProfile } from "./profileScoring.js";

// Issue record helpers.
//
// DashboardSidebar.jsx calls getAllIssueRecords() to create the list rendered
// by IssueSummaryCard.jsx. DashboardPage.jsx also uses findIssueRecordByIdentifier()
// to connect a clicked card to the detail and preview panels.
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

export function getIssueDimensionName(issueRecord) {
  return displayDimensionName(issueRecord?.dimensionResult?.dimension || "");
}
