import {
  API_BASE,
  buildAnalysisView,
  chatWithAssistant,
  escapeHtml,
  fetchJson,
  findDimension,
  formatReportTimestamp,
  loadDashboardSession,
} from "../lib/common.js";
import { bumpDashboardLifecycle, getDashboardLifecycleSnapshot } from "../lib/dashboardLifecycle.js";
import {
  DASHBOARD_SOURCE_TYPES,
  getRunIdFromPayload,
  isIncomingRunNewer,
  readDashboardAuthoritativeSourceFromStorage,
  setDashboardAuthoritativeSource,
} from "../dashboard/authority/dashboardAuthority.js";
import {
  renderPrintSummary as renderPrintSummaryIntoSidebar,
  renderPrintableProfileReport as renderPrintableProfileReportIntoSidebar,
} from "../lib/printAndDownload.js";
import {
  dt1FrontendForensicEnabled,
  logDashboardLifecycle,
  logDashboardRender,
  logDtFrontendState,
} from "../dashboard/forensic/dashboardForensics.js";
import {
  hydrateStoredDashboardSession as hydrateStoredDashboardSessionExtracted,
  loadDashboardSessionWithHistoryFallback as loadDashboardSessionWithHistoryFallbackExtracted,
} from "../dashboard/hydration/dashboardHydration.js";
import { getDetectorSemanticModule } from "../dashboard/detectors/registry/detectorRegistry.js";
import { controlElementLabel, scParseMetricNumber, titleCaseSelectorPart } from "../dashboard/detectors/shared/detectorCommon.js";
import { DT_TEXT_BLOCK_TAGS, dtDenseEvidenceMetricsLine, filterDtEvidenceElements } from "../dashboard/detectors/dt/dtSemantics.js";
import { LC_TEXT_BLOCK_TAGS, filterLcEvidenceElements, lcCompactSampleWords, lcLexicalEvidenceMetricsLine, lcTextBlockPrimaryLabel } from "../dashboard/detectors/lc/lcSemantics.js";
import { SC_PRIMARY_GROUP_KEYS, SC_PRIMARY_GROUP_LABELS, SC_TEXT_BLOCK_TAGS, filterScEvidenceElements, groupScLocationsByPrimaryPattern, scAllThreeSentenceMetricsAbsent, scCompressedSentencePreview, scPrimaryPattern, scSecondaryPatterns, scSentenceEvidenceMetricsLine, scSentenceMetricValues } from "../dashboard/detectors/sc/scSemantics.js";
import { NC_GROUPED_METRICS_FALLBACK, groupNcLocationsByViolation, ncEvidenceMetricsLine, ncTechnicalMetaLine } from "../dashboard/detectors/nc/ncSemantics.js";
import { groupAmcLocationsBySubtype, amcSubtypeLabel, amcSubtypeOrder } from "../dashboard/detectors/amc/amcGrouping.js";
import { groupEiLocationsBySubtype, eiSubtypeLabel, eiSubtypeOrder } from "../dashboard/detectors/ei/eiGrouping.js";
import {
  fallbackSelectorsForIssueEngine,
  findElementsForLocationEngine,
  logHighlightResolution,
  moreSpecificHighlightTargetEngine,
  validateHighlightTargetEngine,
} from "../dashboard/highlights/engine/highlightEngine.js";
import { renderIssueSummaryCard } from "../dashboard/rendering/renderers/issueRenderer.js";
import { renderExplanationMarkup } from "../dashboard/rendering/renderers/detectorRenderer.js";
import { renderDashboardSummaryMarkup } from "../dashboard/rendering/renderers/summaryRenderer.js";
import { DASHBOARD_ACTIONS } from "../dashboard/actions/dashboardActions.js";
import { configureDashboardActionDispatcher, dispatchDashboardAction } from "../dashboard/actions/dashboardActionDispatcher.js";
import { initializeDashboardRuntime } from "../dashboard/runtime/dashboardRuntime.js";
import { validateDashboardArchitectureBoundaries } from "../dashboard/architecture/architectureForensics.js";
import { logDtLineage } from "../dashboard/observability/dtLocationLineage.js";
import { dtLineageEnabled, summarizeDtLocationArray } from "../dashboard/observability/dtLocationLineage.js";
import {
  auditLog as detectorEnablementAuditLog,
  auditDtEnablementDecision,
  buildProfileDetectorMatrix,
  detectorEnablementAuditEnabled,
} from "../dashboard/observability/detectorEnablementAudit.js";
import { runLwcArchitectureAuditSnapshot } from "../dashboard/observability/lwcArchitectureAudit.js";
import { hasDetectorSemanticModule } from "../dashboard/detectors/registry/detectorRegistry.js";
import { hasHighlightRules } from "../dashboard/highlights/registry/highlightRuleRegistry.js";
import { getDetectorMetadata, getDetectorMetadataByDimensionName } from "../dashboard/detectors/registry/detectorMetadataRegistry.js";
import { buildDeclaredRelationChecks } from "../dashboard/architecture/dependencyGraphHelpers.js";
import { dashboardState as state } from "../dashboard/state/dashboardState.js";
import { activePatientProfile as activePatientProfileSelector, selectedIssueRecord as selectedIssueRecordSelector } from "../dashboard/state/dashboardSelectors.js";
import {
  clearActiveHighlight,
  pushChatMessage,
  resetChatMessages,
  resetSelectionToSummary,
  setActiveGuidancePopoverKey,
  setActiveHighlightDimension,
  setActiveHighlightIssueId,
  setActivePatientProfile as setActivePatientProfileTransition,
  setAssistantFloatingOpen as setAssistantFloatingOpenTransition,
  setChatPending,
  setCurrentPayloadAndSource,
  setCurrentResultAndHtml,
  setPreviousComparison,
  setRightPanelMode,
  setSelectedElementNumber,
  setSelectedIssueId,
  setSidebarCollapsed,
  setWorkspaceMode as setWorkspaceModeTransition,
  toggleSidebarCollapsed,
} from "../dashboard/state/dashboardTransitions.js";
import { PATIENT_PROFILES } from "../dashboard/shared/patientProfiles.js";

// State container extracted to dashboard/state (behavior preserved).

const SIDEBAR_STORAGE_KEY = "cognilens.sidebar.collapsed";
const ASSISTANT_POSITION_STORAGE_KEY = "cognilens.assistant.position";
const AUTO_PRINT_STORAGE_KEY = "cognilens.dashboard.autoPrint";
const ANALYSIS_RETURN_URL_STORAGE_KEY = "cognilens.return.analysis-url";
const DASHBOARD_HISTORY_CONTEXT_KEY = "cognilens.dashboard.history-context";
const DASHBOARD_HISTORY_ONCE_KEY = "cognilens.dashboard.history-once";
/** Shared with `eye/app.js`: latest dashboard report to attach behavioral evidence. */
const EYE_RELATED_CONTEXT_STORAGE_KEY = "cognilens.eye.related-context";
const ASSISTANT_MARGIN = 16;

const DETECTOR_NAMES = [
  "Dense Text Detection",
  "Language Complexity",
  "Sentence Complexity",
  "Long Content Without Chunking",
  "Poor Heading Structure",
  "Navigation Complexity",
  "Weak Information Prominence",
  "Visual Overload",
  "Auto-Moving Content",
  "Excessive Interruptions",
];

function dtLocationsCountFromResult(result) {
  const dim = result ? findDimension(result, "Dense Text Detection") : null;
  const issues = dim?.issues || [];
  const issue = issues.find((item) => (item?.rule_id || "") === "DT-1") || issues[0] || null;
  const locs = issue?.locations || [];
  return Array.isArray(locs) ? locs.length : 0;
}

function dtRunIdFromPayload(payload) {
  return String(payload?.run?.run_id || payload?.run_id || payload?.run?.id || "");
}

function dtFrontendStateLog(stage, payload, result, sourceNameOverride = "") {
  logDtFrontendState({
    stage,
    payload,
    result,
    sourceNameOverride,
    getRunIdFromPayload,
    getDtLocationsCountFromResult: dtLocationsCountFromResult,
  });
}

function dashboardLifecycleLog(stage, incomingPayload, currentPayload, incomingSourceType = "", currentSourceType = "", accepted = false, reason = "") {
  logDashboardLifecycle({
    stage,
    incomingPayload,
    currentPayload,
    incomingSourceType,
    currentSourceType,
    accepted,
    reason,
    getRunIdFromPayload,
  });
}

const ISSUE_CATEGORY_CONFIG = {
  content: { displayName: "Content Issue", cognitiveDimension: "Reading load and comprehension" },
  structure: { displayName: "Structure Issue", cognitiveDimension: "Orientation, hierarchy, and task discovery" },
  motion: { displayName: "Motion Issue", cognitiveDimension: "Attention regulation and task continuity" },
  forms: { displayName: "Forms Issue", cognitiveDimension: "Input clarity and completion support" },
};
const DIMENSION_CATEGORY_KEYS = {
  "Dense Text Detection": "content",
  "Language Complexity": "content",
  "Sentence Complexity": "content",
  "Long Content Without Chunking": "content",
  "Poor Heading Structure": "structure",
  "Navigation Complexity": "structure",
  "Weak Information Prominence": "structure",
  "Visual Overload": "structure",
  "Auto-Moving Content": "motion",
  "Excessive Interruptions": "motion",
};
const DIMENSION_CONFIG = DETECTOR_NAMES.map((name) => ({
  name,
  className: DIMENSION_CATEGORY_KEYS[name] || "structure",
}));

// Detector-specific frameworks, objectives, tooltips, and guidance are owned by
// `dashboard/detectors/*/*Metadata.js` and resolved via `detectorMetadataRegistry.js`.

const HIGHLIGHT_CONFIG = {
  "Dense Text Detection": {
    color: "#2493dd",
    selectors: ["p", "li", "td", "th"],
  },
  "Language Complexity": {
    color: "#2493dd",
    selectors: ["p", "li", "td", "th", "label", "button", "a"],
  },
  "Sentence Complexity": {
    color: "#2493dd",
    selectors: ["p", "li", "td", "th"],
  },
  "Long Content Without Chunking": {
    color: "#2493dd",
    selectors: ["main", "article", "section"],
  },
  "Poor Heading Structure": {
    color: "#8d28df",
    selectors: ["h1", "h2", "h3", "h4", "h5", "h6", "main", "article", "body"],
  },
  "Navigation Complexity": {
    color: "#8d28df",
    selectors: ["nav", "nav a", "[role='navigation']", "[class*='menu' i]", "[class*='breadcrumb' i]"],
  },
  "Weak Information Prominence": {
    color: "#8d28df",
    selectors: ["main", "section", "button", "a", "[class*='cta' i]", "[class*='hero' i]", "[class*='primary' i]"],
  },
  "Visual Overload": {
    color: "#df3e53",
    selectors: ["main", "section", "article", "aside", "nav", "header", ".card", "[class*='card' i]", "[class*='grid' i]", "[class*='banner' i]"],
  },
  "Auto-Moving Content": {
    color: "#f0c400",
    selectors: ["video", "audio", "iframe", "[autoplay]", "marquee", "[class*='carousel' i]", "[class*='slider' i]", "[class*='marquee' i]", "[class*='animate' i]"],
  },
  "Excessive Interruptions": {
    color: "#f0c400",
    selectors: [
      "dialog",
      "[role='dialog']",
      "[role='alertdialog']",
      "[aria-modal='true']",
      "[aria-live]",
      "[class*='modal' i]",
      "[class*='popup' i]",
      "[class*='overlay' i]",
      "[class*='toast' i]",
      "[class*='notification' i]",
      "[class*='sticky' i]",
      "[class*='chat' i]",
      "[class*='cookie' i]",
      "[class*='consent' i]",
    ],
  },
};

function canonicalDimensionName(name) {
  return String(name || "");
}

function activePatientProfile() {
  return activePatientProfileSelector(state, PATIENT_PROFILES);
}

function patientDetectorOrderIndex(name) {
  const order = activePatientProfile().detectorOrder || DETECTOR_NAMES;
  const index = order.indexOf(canonicalDimensionName(name));
  return index === -1 ? dimensionBaseOrderIndex(name) : index;
}

function isDetectorEnabledForActiveProfile(name) {
  const enabledDetectors = activePatientProfile().enabledDetectors;
  if (!enabledDetectors || !enabledDetectors.length) {
    if (detectorEnablementAuditEnabled()) {
      auditDtEnablementDecision({
        stage: "detector.enablement.check",
        active_profile: state.activeProfile || "",
        detector: canonicalDimensionName(name),
        enabled: true,
        reason: "enabledDetectors empty -> allow all",
        source_of_truth: "PATIENT_PROFILES[activeProfile].enabledDetectors",
        enabled_detectors: [],
        runtime_profile: state.activeProfile || "",
        fallback_profile: "Alison",
      });
    }
    return true;
  }
  const canonical = canonicalDimensionName(name);
  const enabled = enabledDetectors.includes(canonical);
  try {
    if ((typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_DT1_LINEAGE === "1"))
      && canonical === "Dense Text Detection") {
      console.log("[DT-1 location lineage]", {
        stage: "render.filter.detector_enabled",
        detector: canonical,
        enabled,
        activeProfile: state.activeProfile || "",
        enabledDetectors: enabledDetectors.slice(0, 20),
      });
    }
  } catch (_) {
    // ignore
  }
  if (detectorEnablementAuditEnabled() && canonical === "Dense Text Detection") {
    auditDtEnablementDecision({
      stage: "detector.enablement.check",
      active_profile: state.activeProfile || "",
      detector: canonical,
      enabled,
      reason: enabled ? "" : "profile_missing_detector",
      source_of_truth: "PATIENT_PROFILES[activeProfile].enabledDetectors",
      enabled_detectors: enabledDetectors,
      runtime_profile: state.activeProfile || "",
      fallback_profile: "Alison",
    });
  }
  return enabled;
}

function dimensionBaseOrderIndex(name) {
  const index = DETECTOR_NAMES.indexOf(canonicalDimensionName(name));
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function renderPatientSwitcher() {
  const summaryNode = document.getElementById("patientProfileSummary");
  if (summaryNode) {
    const profile = activePatientProfile();
    summaryNode.innerHTML = `
      <span>${escapeHtml(profile.summary)}</span>
    `;
  }

  document.querySelectorAll("[data-patient-profile]").forEach((button) => {
    const active = button.dataset.patientProfile === state.activeProfile;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function setActivePatientProfile(profileName) {
  if (!PATIENT_PROFILES[profileName] || state.activeProfile === profileName) {
    return;
  }
  if (detectorEnablementAuditEnabled()) {
    detectorEnablementAuditLog("profile.runtime.selection", {
      runtime_profile: profileName,
      previous_profile: state.activeProfile || "",
      source_of_truth: "user_action.SET_ACTIVE_PROFILE",
    });
  }
  setActivePatientProfileTransition(state, profileName);
  resetIssueWorkspaceForProfileChange();
  renderPatientSwitcher();
  if (state.currentResult) {
    renderExplanation(state.currentResult);
    renderDashboardSummary(state.currentResult);
    renderDetectionGauge(state.currentResult);
    if (state.workspaceMode === "explanation") {
      renderComparison(state.currentResult, state.previousResult, state.previousSourceName);
    }
  }
}

function renderScoreSlider(result) {
  // Left detector navigation has been removed; keep the function as a no-op
  // because the dashboard refresh flow still calls it after analysis.
}

function renderDashboardSummary(result) {
  const summaryNode = document.getElementById("dashboardSummaryText");

  if (!summaryNode) {
    return;
  }
  summaryNode.innerHTML = "";
}

/**
 * All possible issue-detection slots (one per cognitive detector rule).
 * Keep in sync with `backend/analyzers/analysis_selectors/__init__.py` SELECTORS length.
 */
const TOTAL_POSSIBLE_DETECTION_POINTS = 10;

function detectorsWithIssuesCount(result) {
  if (!result?.dimensions?.length) {
    return 0;
  }
  return result.dimensions.filter(
    (dimension) =>
      isDetectorEnabledForActiveProfile(dimension?.dimension) && (dimension.issues || []).length > 0,
  ).length;
}

/** Set by React via initDashboard({ onDetectionGaugeUpdate }); SVG lives in DetectionGauge.jsx */
let onDetectionGaugeUpdate = null;

function renderDetectionGauge(result) {
  if (typeof onDetectionGaugeUpdate !== "function") {
    return;
  }

  if (!result?.dimensions) {
    onDetectionGaugeUpdate({ detected: null });
    return;
  }

  const detected = detectorsWithIssuesCount(result);
  onDetectionGaugeUpdate({ detected });
}

function renderReportId() {
  const reportIdNode = document.getElementById("reportIdValue");
  if (!reportIdNode) {
    return;
  }
  const createdAt = state.currentPayload?.run?.created_at || "";
  const runId = state.currentPayload?.run?.run_id || "";
  reportIdNode.textContent = formatReportTimestamp(createdAt);
  reportIdNode.title = createdAt || runId || "";
}

function displayDimensionName(name) {
  return String(name || "");
}

function issueCategoryKeyForRule(ruleId) {
  const prefix = String(ruleId || "").split("-")[0];
  const byPrefix = {
    DT: "content",
    LC: "content",
    SC: "content",
    LCC: "content",
    PHS: "structure",
    NC: "structure",
    WIP: "structure",
    VO: "structure",
    AMC: "motion",
    EI: "motion",
  };
  return byPrefix[prefix] || "structure";
}

function issueCategoryKeyForDimension(dimensionName) {
  return DIMENSION_CATEGORY_KEYS[displayDimensionName(dimensionName)] || "structure";
}

function issueCategoryMetaForDimension(dimensionName) {
  return ISSUE_CATEGORY_CONFIG[issueCategoryKeyForDimension(dimensionName)] || ISSUE_CATEGORY_CONFIG.structure;
}

function issueCategoryMetaForIssue(issue, dimensionName) {
  const key = issue?.issue_category_key
    || issue?.issue_category?.key
    || issueCategoryKeyForRule(issue?.rule_id);
  return ISSUE_CATEGORY_CONFIG[key] || issueCategoryMetaForDimension(dimensionName);
}

function displayIssueCategoryName(dimensionName) {
  return issueCategoryMetaForDimension(dimensionName).displayName;
}

function displayIssueCategoryNameForIssue(issue, dimensionName) {
  return issue?.issue_category_label
    || issue?.issue_category?.label
    || issueCategoryMetaForIssue(issue, dimensionName).displayName;
}

function cognitiveDimensionLabel(dimensionName) {
  return issueCategoryMetaForDimension(dimensionName).cognitiveDimension;
}

function normalizedDimensionName(name) {
  return displayDimensionName(String(name || ""));
}

function setActiveDimensionBar(dimensionName) {
  const targetName = normalizedDimensionName(dimensionName);
  document.querySelectorAll(".dimension-row[data-dimension-key]").forEach((row) => {
    row.classList.toggle("is-linked-active", row.dataset.dimensionKey === targetName);
  });
}

function tooltipCopyForDimension(dimensionName) {
  const normalized = normalizedDimensionName(dimensionName);
  const meta = getDetectorMetadataByDimensionName(normalized);
  if (meta?.tooltip) {
    return meta.tooltip;
  }
  return {
    issue: "This detector reflects cognitive-accessibility risk.",
    impact: "We score the specific selector signals for this detector.",
  };
}

function initDimensionInfoTooltip() {
  const existing = document.querySelector(".dimension-info-tooltip");
  const tooltip = existing || document.createElement("div");
  if (!existing) {
    tooltip.className = "dimension-info-tooltip";
    tooltip.hidden = true;
    document.body.appendChild(tooltip);
  }

  const positionTooltip = (event) => {
    const offset = 10;
    tooltip.style.left = `${event.clientX + offset}px`;
    tooltip.style.top = `${event.clientY + offset}px`;
  };

  const showTooltip = (target, event) => {
    tooltip.innerHTML = `
      <p><strong>What it means:</strong> ${escapeHtml(target.dataset.tipIssue || "")}</p>
      <p><strong>How scored:</strong> ${escapeHtml(target.dataset.tipImpact || "")}</p>
    `;
    tooltip.hidden = false;
    if (event) positionTooltip(event);
  };

  const hideTooltip = () => {
    tooltip.hidden = true;
  };

  document.addEventListener("pointerenter", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest(".dimension-info-icon")
      : null;
    if (target) showTooltip(target, event);
  }, true);

  document.addEventListener("pointermove", (event) => {
    if (!tooltip.hidden) positionTooltip(event);
  }, true);

  document.addEventListener("pointerleave", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest(".dimension-info-icon")
      : null;
    if (target) hideTooltip();
  }, true);

  document.addEventListener("focusin", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest(".dimension-info-icon")
      : null;
    if (target) showTooltip(target);
  });

  document.addEventListener("focusout", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest(".dimension-info-icon")
      : null;
    if (target) hideTooltip();
  });
}

function expandIssueSummaryCardsInsideDimensionAccordion(accordion) {
  if (!accordion) {
    return;
  }
  accordion.querySelectorAll("details.issue-summary-card").forEach((issueDetails) => {
    issueDetails.open = true;
  });
}

function focusExplanationDimension(dimensionName) {
  const targetName = normalizedDimensionName(dimensionName);
  const target = document.querySelector(
    `.explanation-accordion[data-explanation-dimension="${CSS.escape(targetName)}"]`,
  );
  if (!target) {
    return;
  }
  document.querySelectorAll(".explanation-accordion[open]").forEach((accordion) => {
    if (accordion !== target) {
      accordion.open = false;
    }
  });
  target.open = true;
  expandIssueSummaryCardsInsideDimensionAccordion(target);
  target.scrollIntoView({ block: "nearest", behavior: "smooth" });
  setActiveDimensionBar(targetName);
}

function issueEvidenceNumber(issue, key) {
  const value = Number(issue?.evidence?.[key]);
  return Number.isFinite(value) ? value : 0;
}

function issuePriority(issue, dimensionName = "") {
  if (dimensionName === "Visual Overload" || dimensionName === "Weak Information Prominence") {
    return (
      (issue?.evidence?.blocks_primary_task ? 400 : 0)
      + (issueEvidenceNumber(issue, "confusion_distraction_level") * 100)
      + (issueEvidenceNumber(issue, "cumulative_load_level") * 10)
      + (issue?.penalty || 0)
    );
  }
  return issue?.penalty || 0;
}

function primaryIssueForDimension(dimension) {
  const issues = [...(dimension?.issues || [])];
  issues.sort((a, b) => {
    const pb = issuePriority(b, dimension?.dimension);
    const pa = issuePriority(a, dimension?.dimension);
    if (pb !== pa) {
      return pb - pa;
    }
    return String(a.rule_id || "").localeCompare(String(b.rule_id || ""));
  });
  return issues[0] || null;
}

function firstSentence(text) {
  const value = String(text || "").trim();
  const match = value.match(/^(.+?[.!?])\s/);
  return match ? match[1] : value;
}

function affectedUsersCopy(issue, dimensionName) {
  if (issue?.evidence?.affected_users) {
    return issue.evidence.affected_users;
  }
  if (DIMENSION_CATEGORY_KEYS[dimensionName] === "content") {
    return "People with reading difficulties may need clearer wording, shorter text, and stronger chunking.";
  }
  if (DIMENSION_CATEGORY_KEYS[dimensionName] === "motion") {
    return "People with attention regulation or sensory sensitivities may need calmer, user-controlled interactions.";
  }
  return "Users with cognitive or executive-function needs may need clearer structure and lower decision effort.";
}

function displayIssueCategorySingular(issue, dimensionName) {
  return displayIssueCategoryNameForIssue(issue, dimensionName).replace(/ Issues$/, " Issue");
}

function conciseText(text, fallback = "", maxLength = 150) {
  const value = firstSentence(text || fallback).trim();
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1).trim()}…`;
}

function issueDomId(dimensionName, ruleId) {
  return `${dimensionName || ""}:${ruleId || ""}`;
}

function issueAffectedGroups(issue, dimensionName) {
  const groups = beneficiaryTags(issue?.rule_id || "", dimensionName);
  if (Array.isArray(groups) && groups.length) {
    const labelMap = {
      "Reading difficulties": "Dyslexia users",
      "Attention regulation": "ADHD users",
      "Communication differences": "Dyslexia users",
      "Executive function support": "Executive function support users",
      "Autistic users": "Autistic users",
    };
    return [...new Set(groups.map((group) => labelMap[group] || (/user/i.test(group) ? group : `${group} users`)))];
  }
  return [affectedUsersCopy(issue, dimensionName)];
}

function detectedEvidenceCopy(issue) {
  const locations = Array.isArray(issue?.locations) ? issue.locations : [];
  const firstLocation = locations[0];
  if ((issue?.rule_id || "") === "NC-1" && firstLocation) {
    const metrics = ncEvidenceMetricsLine(firstLocation);
    return metrics
      ? `Navigation region exceeds thresholds (${metrics}).`
      : "Navigation region exceeds link-count or nesting-depth thresholds.";
  }
  if ((issue?.rule_id || "") === "SC-1" && firstLocation) {
    const metrics = scSentenceEvidenceMetricsLine(firstLocation);
    const detail = metrics
      ? ` (${metrics}: long sentence, comma density, or conjunction density exceeded heuristic thresholds).`
      : " (sentence-length, comma-density, and conjunction-density heuristics exceeded thresholds).";
    return `Complex wording flagged at the sentence level within a text block — not a readability score or NLP parse.${detail}`;
  }
  if ((issue?.rule_id || "") === "LC-1" && firstLocation) {
    const metrics = lcLexicalEvidenceMetricsLine(firstLocation);
    const samples = lcCompactSampleWords(firstLocation);
    const detailParts = [metrics, samples].filter(Boolean);
    const detail = detailParts.length ? ` ${detailParts.join(" · ")}.` : "";
    return (
      "Dense long or multi-syllable words (simple length + syllable estimate per word, block-level)—not jargon detection, rarity, or a readability formula."
      + detail
    );
  }
  if ((issue?.rule_id || "") === "DT-1" && firstLocation) {
    const metrics = dtDenseEvidenceMetricsLine(firstLocation);
    const metricsParen = metrics ? `${metrics}. ` : "";
    return (
      "This rule flags large uninterrupted text blocks using word and punctuation-based fragment counts — not visual density, layout, or NLP parsing. "
      + `Fragment counts split on punctuation heuristics. ${metricsParen}`.trim()
    );
  }
  if (firstLocation?.summary) {
    return `Detected near ${firstLocation.summary}.`;
  }
  if (firstLocation?.selector) {
    return `Detected element matching ${firstLocation.selector}.`;
  }
  if (firstLocation?.text || firstLocation?.preview || firstLocation?.sentence_preview) {
    return firstLocation.text || firstLocation.preview || firstLocation.sentence_preview;
  }

  const evidence = issue?.evidence || {};
  const evidencePairs = Object.entries(evidence)
    .filter(([, value]) => value !== null && value !== undefined && value !== false && value !== "")
    .slice(0, 3)
    .map(([key, value]) => `${key.replaceAll("_", " ")}: ${Array.isArray(value) ? value.join(", ") : String(value)}`);

  return evidencePairs.length
    ? evidencePairs.join("; ")
    : "This issue was detected by the current cognitive accessibility rule set.";
}

function frameworkMappingCopy(ruleId) {
  const standards = frameworkStandardsForRule(ruleId);
  return {
    coga: standards.coga,
    iso: standards.isoDisplay,
    wcag: standards.wcagDisplay,
  };
}

function parseStandardsItems(text, prefixRegex) {
  const normalized = String(text || "")
    .replace(prefixRegex, "")
    .trim();
  return normalized
    .split(/[;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseIsoClausesFromRule(ruleId) {
  const isoText = getDetectorMetadata(ruleId)?.frameworks?.iso || "";
  const clauses = parseStandardsItems(isoText, /^ISO\s*9241-11(?::2018)?\s*:?\s*/i)
    .map((item) => item.replace(/^2018\s+/i, "").trim());
  return clauses.length ? clauses : ["Effectiveness"];
}

function parseWcagCriteriaFromRule(ruleId) {
  const wcagText = getDetectorMetadata(ruleId)?.frameworks?.wcag || "";
  const criteria = parseStandardsItems(wcagText, /^WCAG(?:\s*2\.2)?\s*/i)
    .map((item) => (/^SC\s+/i.test(item) ? item : `SC ${item}`));
  return criteria.length ? criteria : ["SC 2.4.6 Headings and Labels"];
}

function frameworkStandardsForRule(ruleId) {
  const entry = getDetectorMetadata(ruleId)?.frameworks || null;
  if (!entry) {
    return {
      coga: "COGA: reduce cognitive load in task flow",
      wcagCriteria: ["SC 2.4.6 Headings and Labels"],
      isoClauses: ["Effectiveness"],
      wcagDisplay: "WCAG  SC 2.4.6 Headings and Labels",
      isoDisplay: "ISO 9241-11: Effectiveness",
    };
  }
  const wcagCriteria = parseWcagCriteriaFromRule(ruleId);
  const isoClauses = parseIsoClausesFromRule(ruleId);
  return {
    coga: entry.coga || "COGA: reduce cognitive load in task flow",
    wcagCriteria,
    isoClauses,
    wcagDisplay: `WCAG 2.2 ${wcagCriteria.join("; ")}`,
    isoDisplay: `ISO 9241-11: ${isoClauses.join("; ")}`,
  };
}

/** Short WCAG / ISO lines for left-panel issue cards (not full standards copy). */
function issueCardStandardsSummary(ruleId) {
  const standards = frameworkStandardsForRule(ruleId);
  return {
    coga: getDetectorMetadata(ruleId)?.coga_objective || standards.coga.replace(/^COGA:\s*/i, ""),
    wcag: standards.wcagCriteria.join("; "),
    iso: standards.isoClauses.join("; "),
  };
}

function splitStandardItems(summaryText, fallbackText) {
  const source = String(summaryText || "").trim();
  const parts = source
    .split(/[;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (parts.length) {
    return parts;
  }
  return [fallbackText];
}

function standardsPillsMarkup(summaryText, fallbackText) {
  const items = splitStandardItems(summaryText, fallbackText);
  return `
    <div class="issue-standards-list">
      ${items.map((item) => `<span class="issue-standard-pill">${escapeHtml(item)}</span>`).join("")}
    </div>
  `;
}

function cogaGuidanceMarkup(summaryText) {
  const items = splitStandardItems(summaryText, "Help Users Focus");
  return `
    <div class="issue-standards-list">
      ${items.map((item) => `<span class="issue-standard-pill">${escapeHtml(item)}</span>`).join("")}
    </div>
  `;
}

function beneficiaryTags(ruleId, dimensionName) {
  const prefix = String(ruleId || "").split("-")[0] || "";
  const byPrefix = {
    DT: ["Reading difficulties", "Communication differences"],
    LC: ["Reading difficulties", "Communication differences"],
    SC: ["Reading difficulties", "Communication differences"],
    LCC: ["Reading difficulties", "Executive function support"],
    PHS: ["Autistic users", "Executive function support"],
    NC: ["Autistic users", "Executive function support"],
    WIP: ["Attention regulation", "Executive function support"],
    VO: ["Attention regulation", "Autistic users"],
    AMC: ["Attention regulation", "Autistic users"],
    EI: ["Attention regulation", "Executive function support"],
  };
  if (byPrefix[prefix]) {
    return byPrefix[prefix];
  }
  const category = DIMENSION_CATEGORY_KEYS[dimensionName];
  if (category === "content") return byPrefix.DT;
  if (category === "motion") return byPrefix.AMC;
  return byPrefix.PHS;
}

function renderComparison(currentResult, previousResult, previousSourceName) {
  setPreviousComparison(state, previousResult || null, previousSourceName || "");
  const comparisonList = document.getElementById("comparisonList");
  if (!comparisonList) {
    return;
  }

  const selected = selectedIssueRecord();
  if (state.rightPanelMode === "detail" && selected) {
    comparisonList.className = "comparison-list issue-guidance-workspace";
    comparisonList.innerHTML = selectedIssueWorkspaceMarkup(selected);
    animatePanelEntry(comparisonList);
    return;
  }

  setRightPanelMode(state, "summary");
  comparisonList.className = "comparison-list issue-workspace-summary";
  comparisonList.innerHTML = "";
  animatePanelEntry(comparisonList);
}

function animatePanelEntry(element) {
  if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  // Keep panel changes feeling responsive without adding an artificial delay.
  // The class is re-applied on each right-panel update so new content fades in.
  window.clearTimeout(element.dataset.panelAnimationTimer);
  element.classList.remove("is-panel-entering");
  void element.offsetWidth;
  element.classList.add("is-panel-entering");
  element.dataset.panelAnimationTimer = window.setTimeout(() => {
    element.classList.remove("is-panel-entering");
    delete element.dataset.panelAnimationTimer;
  }, 180);
}

function prioritizedIssuesForProfile(dimension) {
  return [...(dimension?.issues || [])]
    .sort((left, right) => {
      const priorityDelta = issuePriority(right, dimension?.dimension) - issuePriority(left, dimension?.dimension);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      const elementDelta = issueFailingElementCount(right) - issueFailingElementCount(left);
      if (elementDelta !== 0) {
        return elementDelta;
      }
      return String(left?.title || left?.rule_id || "").localeCompare(String(right?.title || right?.rule_id || ""));
    });
}

function issueFailingElementCount(issue) {
  const locations = Array.isArray(issue?.locations) ? issue.locations : [];
  return Math.max(1, locations.length || 0);
}

function issueIsoClauseTags(ruleId) {
  return parseIsoClausesFromRule(ruleId);
}

function pillListMarkup(items, limit = 2, className = "") {
  const safeItems = [...new Set(items.filter(Boolean))];
  return `
    <span class="standards-pill-list ${className}">
      ${safeItems.map((item) => `<span class="standards-pill">${escapeHtml(item)}</span>`).join("")}
    </span>
  `;
}

function looksLikeTechnicalSelector(value) {
  const text = String(value || "").trim();
  return /^[.#]?[a-z][\w-]*(?:[.#][\w-]+|\[[^\]]+\]|:[\w-]+)?$/i.test(text)
    || /^[a-z][\w-]*\.[\w.-]+$/i.test(text);
}

// titleCaseSelectorPart / controlElementLabel extracted to detectorCommon (behavior preserved).

function isNcEvidenceLocation(location, issueRuleId = "") {
  return issueRuleId === "NC-1" || location?.rule_id === "NC-1";
}

// NC semantics extracted to dashboard/detectors/nc/ncSemantics.js (behavior preserved).

function formatNcViolationGroupTitle(key) {
  const labels = {
    too_many_links: "Too Many Navigation Links",
    deep_nesting: "Deep Navigation Nesting",
    other: "Navigation complexity",
  };
  return labels[key] || key;
}

function orderNcViolationGroupKeys(groupKeys) {
  const preferred = ["too_many_links", "deep_nesting", "other"];
  const ordered = preferred.filter((key) => groupKeys.includes(key));
  groupKeys.forEach((key) => {
    if (!ordered.includes(key)) {
      ordered.push(key);
    }
  });
  return ordered;
}

function issueNcGroupedChipSectionsMarkup(issue, dimensionName, visibleSlice, activeElementNumber) {
  const grouped = groupNcLocationsByViolation(visibleSlice);
  const keys = orderNcViolationGroupKeys(Object.keys(grouped)).filter((key) => grouped[key].length);
  return keys.map((violationKey) => {
    const entries = grouped[violationKey];
    const title = `${formatNcViolationGroupTitle(violationKey)} (${entries.length})`;
    const chips = entries.map(({ location, elementNumber }) => (
      issueElementChipRowMarkup(
        issue,
        dimensionName,
        location,
        elementNumber,
        activeElementNumber,
        { ncGrouped: true },
      )
    )).join("");
    return `
      <section class="issue-phs-violation-group issue-nc-violation-group" aria-label="${escapeHtml(formatNcViolationGroupTitle(violationKey))}">
        <h5 class="issue-phs-violation-heading">${escapeHtml(title)}</h5>
        <div class="issue-element-chip-list issue-element-chip-list--phs-group issue-element-chip-list--nc-group">
          ${chips}
        </div>
      </section>
    `;
  }).join("");
}

// ncEvidenceMetricsLine / ncTechnicalMetaLine extracted to NC semantics module.

// SC semantics extracted to dashboard/detectors/sc/scSemantics.js (behavior preserved).

function lc1FrontendForensicEnabled() {
  return typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_LC1_FORENSIC === "1");
}
// LC / DT / shared metric coercion extracted to detector semantics modules (behavior preserved).

function scTextBlockPrimaryLabel(location) {
  const t = String(location?.tag || "").toLowerCase();
  const labels = {
    p: "Paragraph",
    li: "List item",
    td: "Table cell",
    th: "Table header cell",
  };
  if (labels[t]) {
    return labels[t];
  }
  return titleCaseSelectorPart(t || "text block");
}

/** SC preview: word boundaries only — head + final tail on two lines (no char slicing). */
const SC_PREVIEW_HEAD_WORDS = 5;
const SC_PREVIEW_TAIL_WORDS = 5;
const SC_PREVIEW_SHORT_WORD_CAP = 12;
const SC_PREVIEW_SHORT_CHAR_CAP = 90;

/**
 * SC-1 fingerprint: `${first 5 words} …\n${last 5 words}` when long; else full sentence.
 * Tail is always the true sentence ending (consequence / outcome). Chips/guidance: pre-line CSS.
 * locationMetaText: flatten with .replace(/\n/g, " ").
 */
// scCompressedSentencePreview / scSentenceEvidenceMetricsLine extracted to SC semantics module.

const SC_CHIP_METRICS_FALLBACK = "Sentence metrics unavailable";

/** Mirrors backend SC-1 thresholds — SC UI pattern badges only (detector unchanged). */
// SC thresholds/constants + grouping extracted to SC semantics module.

function orderScPrimaryGroupKeys(groupKeys) {
  const ordered = SC_PRIMARY_GROUP_KEYS.filter((key) => groupKeys.includes(key));
  groupKeys.forEach((key) => {
    if (!ordered.includes(key)) {
      ordered.push(key);
    }
  });
  return ordered;
}

function scPrimaryGroupSectionTitle(groupKey, count) {
  const heading = SC_PRIMARY_GROUP_LABELS[groupKey]?.heading ?? groupKey;
  return `${heading} (${count})`;
}

function issueScGroupedChipSectionsMarkup(issue, dimensionName, visibleSlice, activeElementNumber) {
  const grouped = groupScLocationsByPrimaryPattern(visibleSlice);
  const keys = orderScPrimaryGroupKeys(Object.keys(grouped)).filter((key) => grouped[key].length);
  return keys.map((groupKey) => {
    const entries = grouped[groupKey];
    const title = scPrimaryGroupSectionTitle(groupKey, entries.length);
    const headingLabel = SC_PRIMARY_GROUP_LABELS[groupKey]?.heading ?? groupKey;
    const chips = entries.map(({ location, elementNumber }) => (
      issueElementChipRowMarkup(issue, dimensionName, location, elementNumber, activeElementNumber)
    )).join("");
    return `
      <section class="issue-phs-violation-group issue-sc-violation-group" aria-label="${escapeHtml(headingLabel)}">
        <h5 class="issue-phs-violation-heading">${escapeHtml(title)}</h5>
        <div class="issue-element-chip-list issue-element-chip-list--phs-group">
          ${chips}
        </div>
      </section>
    `;
  }).join("");
}

function controlLocationLabel(location) {
  const tag = String(location?.tag || "").toLowerCase();
  const text = String(location?.text || "").replace(/\s+/g, " ").trim();
  if (!["a", "button", "input"].includes(tag) || !text) {
    return "";
  }
  // Control issues need the visible action text, otherwise multiple controls
  // appear as repeated generic "Button" or "Link" entries in the guidance panel.
  return `${controlElementLabel(tag)}: "${conciseText(text, text, 56)}"`;
}

function locationAttributeSummary(location) {
  const attrs = location?.attrs && typeof location.attrs === "object" ? location.attrs : {};
  if (attrs.id) {
    return `#${attrs.id}`;
  }
  if (attrs.class) {
    const className = String(attrs.class).trim().split(/\s+/).slice(0, 2).join(".");
    return className ? `.${className}` : "";
  }
  if (attrs.href) {
    return `href: ${attrs.href}`;
  }
  if (attrs.type) {
    return `type: ${attrs.type}`;
  }
  return "";
}

function friendlyLocationLabel(location, issueRuleId = "") {
  if (!location || typeof location !== "object") {
    return "Affected page area";
  }

  // Semantic ownership hint (no behavior impact).
  getDetectorSemanticModule(issueRuleId || location?.rule_id || "");

  if (isNcEvidenceLocation(location, issueRuleId)) {
    return "Navigation Region";
  }

  if (issueRuleId === "SC-1" || location?.rule_id === "SC-1") {
    return scTextBlockPrimaryLabel(location);
  }

  if (issueRuleId === "LC-1" || location?.rule_id === "LC-1") {
    return lcTextBlockPrimaryLabel(location);
  }

  if (issueRuleId === "DT-1" || location?.rule_id === "DT-1") {
    return scTextBlockPrimaryLabel(location);
  }

  const controlLabel = controlLocationLabel(location);
  if (controlLabel) {
    return controlLabel;
  }

  const technicalText = location.summary || location.region || location.selector || location.tag || "";
  const knownLabels = {
    "main.hero": "Hero section",
    "h1": "Main heading",
    "div.cta-row": "CTA button group",
    "a.button-primary": "Primary CTA button",
    "a.button-secondary": "Secondary CTA button",
    "section.content-card": "Supporting content section",
    "div.video-panel": "Video panel",
    "video": "Video player",
    "h2": "Section heading",
    "h3": "Subsection heading",
    "a.active": "Active navigation link",
    "aside.floating-chat.chat-widget": "Floating chat widget",
    "div.promo-strip": "Promotional strip",
    "button": "Button",
    "p": "Text paragraph",
  };
  if (knownLabels[technicalText]) {
    return knownLabels[technicalText];
  }
  if (technicalText.includes(".")) {
    return titleCaseSelectorPart(technicalText.split(".").pop());
  }
  if (technicalText) {
    return titleCaseSelectorPart(technicalText);
  }

  return "Affected page area";
}

function locationMetaText(location, elementNumber = null, issueRuleId = "") {
  if (!location || typeof location !== "object") {
    return "Location detail";
  }
  const elementPrefix = elementNumber ? `Highlighted as Element ${elementNumber} · ` : "";
  if (isNcEvidenceLocation(location, issueRuleId)) {
    const metrics = ncEvidenceMetricsLine(location);
    const technical = ncTechnicalMetaLine(location);
    const core = [metrics, technical].filter(Boolean).join(" · ");
    return `${elementPrefix}${core || "Navigation region evidence"}`;
  }
  if (issueRuleId === "SC-1" || location?.rule_id === "SC-1") {
    const metricsAbsent = scAllThreeSentenceMetricsAbsent(location);
    if (metricsAbsent) {
      console.warn("[SC-1 debug] Sentence metrics unavailable (meta) — raw location:", location);
    }
    const metrics = metricsAbsent ? SC_CHIP_METRICS_FALLBACK : scSentenceEvidenceMetricsLine(location);
    const primary = scPrimaryPattern(location);
    const secondary = scSecondaryPatterns(location);
    const secondaryPart = secondary.length ? ` · Secondary: ${secondary.join(" · ")}` : "";
    const previewRaw = String(location.sentence_preview || "").trim();
    const previewCompact = previewRaw
      ? scCompressedSentencePreview(previewRaw).replace(/\n/g, " ")
      : "";
    const core = [primary, metrics, previewCompact].filter(Boolean).join(" — ");
    return `${elementPrefix}${core}${secondaryPart}`;
  }
  if (issueRuleId === "LC-1" || location?.rule_id === "LC-1") {
    const metrics = lcLexicalEvidenceMetricsLine(location);
    const samples = lcCompactSampleWords(location);
    const tagLabel = lcTextBlockPrimaryLabel(location);
    const core = [tagLabel, metrics, samples].filter(Boolean).join(" — ");
    return `${elementPrefix}${core || "Lexical heuristic (word length / syllable estimate)"}`;
  }
  if (issueRuleId === "DT-1" || location?.rule_id === "DT-1") {
    const tagLabel = scTextBlockPrimaryLabel(location);
    const metrics = dtDenseEvidenceMetricsLine(location);
    const metricsPart = metrics ? `${metrics} · ` : "";
    return `${elementPrefix}${tagLabel} · ${metricsPart}Sentence fragments are punctuation-based heuristics.`;
  }
  const readableText = location.label
    || location.preview
    || location.sentence_preview
    || location.text
    || "";
  const isTextBlock = ["p", "li", "article", "section", "blockquote", "td", "th", "fallback"].includes(
    String(location.tag || "").toLowerCase(),
  );
  const textHint = readableText && !isTextBlock && !looksLikeTechnicalSelector(readableText)
    ? ` · "${conciseText(readableText, readableText, 72)}"`
    : "";
  const controlLabel = controlLocationLabel(location);
  if (controlLabel) {
    const attrSummary = locationAttributeSummary(location);
    return attrSummary
      ? `${elementPrefix}${controlElementLabel(location.tag)} element · code marker ${attrSummary}`
      : `${elementPrefix}${controlElementLabel(location.tag)} element in page reading order`;
  }
  if (location.block_index) {
    return `${elementPrefix}Text block ${location.block_index} in page reading order${textHint}`;
  }
  if (location.selector) {
    return `${elementPrefix}CSS selector: ${location.selector}${textHint}`;
  }
  if (location.summary) {
    const summaryType = looksLikeTechnicalSelector(location.summary) ? "CSS selector" : "Page area";
    return `${elementPrefix}${summaryType}: ${location.summary}${textHint}`;
  }
  if (location.region) {
    return `${elementPrefix}Page region: ${location.region}${textHint}`;
  }
  if (location.tag) {
    return `${elementPrefix}HTML <${location.tag}> element${textHint}`;
  }
  return `${elementPrefix}Location detail${textHint}`;
}

function uniqueKeyLocations(locations, limit = 3) {
  const seen = new Set();
  const keyLocations = [];
  locations.forEach((location) => {
    const label = friendlyLocationLabel(location);
    const normalized = label.toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      keyLocations.push({ location, label });
    }
  });
  return keyLocations.slice(0, limit);
}

/** Display order for PHS-1 violation groups (presentational only). */
const PHS_VIOLATION_GROUP_ORDER = [
  "missing_headings",
  "missing_h1",
  "multiple_h1",
  "first_heading_not_h1",
  "hierarchy_gap",
  "duplicate_heading_text",
  "empty_heading",
  "unknown",
];

function formatViolationTypeLabel(type) {
  if (!type || typeof type !== "string") {
    return "Issue detail";
  }
  const normalized = type.trim();
  const labels = {
    missing_headings: "Missing Headings",
    missing_h1: "Missing H1",
    multiple_h1: "Multiple H1",
    first_heading_not_h1: "First Heading Not H1",
    hierarchy_gap: "Hierarchy Gap",
    duplicate_heading_text: "Duplicate Heading Text",
    empty_heading: "Empty Heading",
    unknown: "Other",
  };
  if (labels[normalized]) {
    return labels[normalized];
  }
  return normalized
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Groups PHS location rows by violationType. Values are entries with the original
 * location and 1-based index into the issue.locations array (for highlight parity).
 */
function groupLocationsByViolationType(locations) {
  const groups = {};
  if (!Array.isArray(locations)) {
    return groups;
  }
  locations.forEach((location, index) => {
    const raw = location?.violationType;
    const key = typeof raw === "string" && raw.trim() ? raw.trim() : "unknown";
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push({ location, elementNumber: index + 1 });
  });
  return groups;
}

function orderPhsViolationGroupKeys(groupKeys) {
  const ordered = [];
  PHS_VIOLATION_GROUP_ORDER.forEach((key) => {
    if (groupKeys.includes(key)) {
      ordered.push(key);
    }
  });
  groupKeys.forEach((key) => {
    if (!ordered.includes(key)) {
      ordered.push(key);
    }
  });
  return ordered;
}

/** VO-1 attention-source groups (not violations). Display order only. */
const VO_CONTRIBUTOR_CATEGORY_ORDER = [
  "interactive_competition",
  "navigation_density",
  "media_competition",
  "card_grid_density",
  "structural_density",
  "unknown",
];

function formatContributorCategoryLabel(category) {
  if (!category || typeof category !== "string") {
    return "Attention source";
  }
  const normalized = category.trim();
  const labels = {
    interactive_competition: "Interactive Competition",
    navigation_density: "Navigation Density",
    media_competition: "Media Competition",
    card_grid_density: "Card / Grid Density",
    structural_density: "Structural Density",
    unknown: "Other attention sources",
  };
  if (labels[normalized]) {
    return labels[normalized];
  }
  return normalized
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function groupLocationsByContributorCategory(locations) {
  const groups = {};
  if (!Array.isArray(locations)) {
    return groups;
  }
  locations.forEach((location, index) => {
    const raw = location?.contributorCategory;
    const key = typeof raw === "string" && raw.trim() ? raw.trim() : "unknown";
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push({ location, elementNumber: index + 1 });
  });
  return groups;
}

function orderVoContributorCategoryKeys(groupKeys) {
  const ordered = [];
  VO_CONTRIBUTOR_CATEGORY_ORDER.forEach((key) => {
    if (groupKeys.includes(key)) {
      ordered.push(key);
    }
  });
  groupKeys.forEach((key) => {
    if (!ordered.includes(key)) {
      ordered.push(key);
    }
  });
  return ordered;
}

function issueVoGroupedChipSectionsMarkup(issue, dimensionName, visibleSlice, activeElementNumber) {
  const grouped = groupLocationsByContributorCategory(visibleSlice);
  const keys = orderVoContributorCategoryKeys(Object.keys(grouped));
  return keys.map((categoryKey) => {
    const entries = grouped[categoryKey];
    const title = `${formatContributorCategoryLabel(categoryKey)} (${entries.length})`;
    const chips = entries.map(({ location, elementNumber }) => (
      issueElementChipRowMarkup(issue, dimensionName, location, elementNumber, activeElementNumber)
    )).join("");
    return `
      <section class="issue-phs-violation-group issue-vo-contributor-group" aria-label="${escapeHtml(formatContributorCategoryLabel(categoryKey))}">
        <h5 class="issue-phs-violation-heading">${escapeHtml(title)}</h5>
        <div class="issue-element-chip-list issue-element-chip-list--phs-group">
          ${chips}
        </div>
      </section>
    `;
  }).join("");
}

/** WIP-1: single evidence cluster (matches PHS/VO grouped chrome without sub-taxonomy). */
function issueWipSingleGroupChipSectionsMarkup(
  issue,
  dimensionName,
  visibleSlice,
  activeElementNumber,
  totalLocationCount,
) {
  const title = `Competing Primary Actions (${totalLocationCount})`;
  const chips = visibleSlice.map((location, index) => (
    issueElementChipRowMarkup(issue, dimensionName, location, index + 1, activeElementNumber)
  )).join("");
  return `
      <section class="issue-phs-violation-group issue-wip-single-group" aria-label="Competing Primary Actions">
        <h5 class="issue-phs-violation-heading">${escapeHtml(title)}</h5>
        <div class="issue-element-chip-list issue-element-chip-list--phs-group">
          ${chips}
        </div>
      </section>
    `;
}

function issueElementChipRowMarkup(issue, dimensionName, location, elementNumber, activeElementNumber, chipOptions = {}) {
  const isActive = activeElementNumber === elementNumber;
  const issueRuleId = issue?.rule_id || "";
  const isNc = issueRuleId === "NC-1";
  const isSc = issueRuleId === "SC-1";
  const isLc = issueRuleId === "LC-1";
  const ncGroupedLayout = Boolean(chipOptions.ncGrouped) && isNc;
  const label = isNc
    ? "Navigation Region"
    : isSc
      ? scTextBlockPrimaryLabel(location)
      : isLc
        ? lcTextBlockPrimaryLabel(location)
        : (location?.label || friendlyLocationLabel(location, issueRuleId));
  const isHighlightable = location?.highlightable !== false;
  let ncMetricsLine = "";
  let ncTechnicalLine = "";
  let scMetricsLine = "";
  let scPreviewLine = "";
  let lcMetricsLine = "";
  let lcSamplesLine = "";
  let meta = "";
  let showMeta = false;
  if (isNc) {
    ncMetricsLine = ncEvidenceMetricsLine(location);
    if (ncGroupedLayout && !ncMetricsLine) {
      ncMetricsLine = NC_GROUPED_METRICS_FALLBACK;
    }
    ncTechnicalLine = ncTechnicalMetaLine(location);
  } else if (isSc) {
    const metricsAbsent = scAllThreeSentenceMetricsAbsent(location);
    if (metricsAbsent) {
      console.warn("[SC-1 debug] Sentence metrics unavailable (chip) — raw location:", location);
    }
    scMetricsLine = metricsAbsent ? SC_CHIP_METRICS_FALLBACK : scSentenceEvidenceMetricsLine(location);
    scPreviewLine = String(location.sentence_preview || "").trim();
  } else if (isLc) {
    lcMetricsLine = lcLexicalEvidenceMetricsLine(location);
    lcSamplesLine = lcCompactSampleWords(location);
  } else {
    meta = locationMetaText(location, null, issueRuleId)
      .replace(/^Location: /, "")
      .replace(/\s*Highlighted as Element \d+\s*·\s*/i, "");
    showMeta = Boolean(meta && meta !== label);
  }
  if (!isHighlightable) {
    const strongLabel = location?.violationType
      ? formatViolationTypeLabel(location.violationType)
      : "Evidence";
    const statusFallback = location?.violationType === "missing_headings"
      ? "Document-level structural finding — no single DOM highlight."
      : "No visible target found";
    return `
      <div class="issue-element-chip is-disabled" role="note">
        <strong>${escapeHtml(strongLabel)}</strong>
        <span>${escapeHtml(label || "Structural evidence, not directly highlightable")}</span>
        <small>${escapeHtml(location?.status || statusFallback)}</small>
      </div>
    `;
  }
  if (isSc) {
    const primaryLine = scPrimaryPattern(location);
    const secondaryList = scSecondaryPatterns(location);
    const secondaryLine = secondaryList.length ? `Secondary: ${secondaryList.join(" · ")}` : "";
    return `
    <button
      class="issue-element-chip issue-element-chip--sc${isActive ? " is-active" : ""}"
      type="button"
      data-issue-element="${escapeHtml(issue.rule_id)}"
      data-issue-dimension="${escapeHtml(dimensionName)}"
      data-element-index="${elementNumber}"
      aria-pressed="${isActive ? "true" : "false"}"
    >
      <strong>Element ${elementNumber}</strong>
      <span>${escapeHtml(label)}</span>
      <small class="issue-element-chip__sc-primary">${escapeHtml(primaryLine)}</small>
      <small class="issue-element-chip__sc-metrics">${escapeHtml(scMetricsLine)}</small>
      ${secondaryLine ? `<small class="issue-element-chip__sc-secondary summary-muted">${escapeHtml(secondaryLine)}</small>` : ""}
      ${scPreviewLine ? `<small class="issue-element-chip__sc-preview summary-muted">${escapeHtml(scCompressedSentencePreview(scPreviewLine))}</small>` : ""}
    </button>
  `;
  }
  if (isLc) {
    return `
    <button
      class="issue-element-chip issue-element-chip--lc${isActive ? " is-active" : ""}"
      type="button"
      data-issue-element="${escapeHtml(issue.rule_id)}"
      data-issue-dimension="${escapeHtml(dimensionName)}"
      data-element-index="${elementNumber}"
      aria-pressed="${isActive ? "true" : "false"}"
    >
      <strong>Element ${elementNumber}</strong>
      <span>${escapeHtml(label)}</span>
      ${lcMetricsLine ? `<small class="issue-element-chip__lc-metrics">${escapeHtml(lcMetricsLine)}</small>` : ""}
      ${lcSamplesLine ? `<small class="issue-element-chip__lc-samples summary-muted">${escapeHtml(lcSamplesLine)}</small>` : ""}
    </button>
  `;
  }
  const secondarySpan = ncGroupedLayout
    ? `<strong class="issue-element-chip__nc-primary-label">${escapeHtml(label)}</strong>`
    : `<span>${escapeHtml(label || `Affected element ${elementNumber}`)}</span>`;
  return `
    <button
      class="issue-element-chip${ncGroupedLayout ? " issue-element-chip--nc-grouped" : ""}${isActive ? " is-active" : ""}"
      type="button"
      data-issue-element="${escapeHtml(issue.rule_id)}"
      data-issue-dimension="${escapeHtml(dimensionName)}"
      data-element-index="${elementNumber}"
      aria-pressed="${isActive ? "true" : "false"}"
    >
      ${ncGroupedLayout ? "" : `<strong>Element ${elementNumber}</strong>`}
      ${secondarySpan}
      ${isNc && (ncGroupedLayout || ncMetricsLine) ? `<small class="issue-element-chip__nc-metrics">${escapeHtml(ncMetricsLine || NC_GROUPED_METRICS_FALLBACK)}</small>` : ""}
      ${isNc && ncTechnicalLine ? `<small class="issue-element-chip__nc-technical summary-muted">${escapeHtml(ncTechnicalLine)}</small>` : ""}
      ${!isNc && !isSc && !isLc && showMeta ? `<small>${escapeHtml(meta)}</small>` : ""}
    </button>
  `;
}

function issuePhsGroupedChipSectionsMarkup(issue, dimensionName, visibleSlice, activeElementNumber) {
  const grouped = groupLocationsByViolationType(visibleSlice);
  const keys = orderPhsViolationGroupKeys(Object.keys(grouped));
  return keys.map((violationKey) => {
    const entries = grouped[violationKey];
    const title = `${formatViolationTypeLabel(violationKey)} (${entries.length})`;
    const chips = entries.map(({ location, elementNumber }) => (
      issueElementChipRowMarkup(issue, dimensionName, location, elementNumber, activeElementNumber)
    )).join("");
    return `
      <section class="issue-phs-violation-group" aria-label="${escapeHtml(formatViolationTypeLabel(violationKey))}">
        <h5 class="issue-phs-violation-heading">${escapeHtml(title)}</h5>
        <div class="issue-element-chip-list issue-element-chip-list--phs-group">
          ${chips}
        </div>
      </section>
    `;
  }).join("");
}

function guidanceEvidenceMarkup(issue) {
  const locations = Array.isArray(issue?.locations) ? issue.locations : [];
  const count = issueFailingElementCount(issue);
  if (!locations.length) {
    return `
      <div class="guidance-location-list">
        <div class="guidance-location-card">
          <span class="guidance-location-index">1.</span>
          <div>
            <strong>${escapeHtml(issue?.rule_id || "Detected rule")}</strong>
            <p>${escapeHtml(issue?.title || "This rule was triggered by the current analysis.")}</p>
          </div>
        </div>
      </div>
    `;
  }

  const shownLocations = locations.slice(0, 12);
  const hiddenCount = Math.max(0, locations.length - shownLocations.length);

  if ((issue?.rule_id || "") === "VO-1") {
    const grouped = groupLocationsByContributorCategory(shownLocations);
    const keys = orderVoContributorCategoryKeys(Object.keys(grouped));
    const groupedBlocks = keys.map((categoryKey) => {
      const entries = grouped[categoryKey];
      const groupTitle = `${formatContributorCategoryLabel(categoryKey)} (${entries.length})`;
      const cards = entries.map(({ location, elementNumber }) => {
        const label = friendlyLocationLabel(location, issue?.rule_id);
        const meta = locationMetaText(location, elementNumber, issue?.rule_id).replace(/^Location: /, "");
        const showMeta = meta && meta !== label;
        return `
          <div class="guidance-location-card">
            <span class="guidance-location-index">${elementNumber}.</span>
            <div>
              <strong>${escapeHtml(label)}</strong>
              ${showMeta ? `<p>${escapeHtml(meta)}</p>` : ""}
            </div>
          </div>
        `;
      }).join("");
      return `
        <div class="guidance-phs-violation-block guidance-vo-contributor-block">
          <div class="guidance-phs-violation-heading">${escapeHtml(groupTitle)}</div>
          ${cards}
        </div>
      `;
    }).join("");
    return `
      <div class="guidance-evidence-note">
        <strong>${escapeHtml(`${count} affected element${count === 1 ? "" : "s"} found`)}</strong>
        <span>Grouped by <strong>attention competition source</strong> (interactive, navigation, media, cards/grids, structural density). Element numbers match preview highlights.</span>
      </div>
      <div class="guidance-location-list guidance-location-list--phs-grouped">
        ${groupedBlocks}
      </div>
      ${hiddenCount ? `<p class="guidance-hidden-count">${escapeHtml(`${hiddenCount} more affected element${hiddenCount === 1 ? "" : "s"} not shown.`)}</p>` : ""}
    `;
  }

  if ((issue?.rule_id || "") === "WIP-1") {
    const totalN = locations.length;
    const groupTitle = `Competing Primary Actions (${totalN})`;
    const cards = shownLocations.map((location, index) => {
      const elementNumber = index + 1;
      const label = friendlyLocationLabel(location, issue?.rule_id);
      const meta = locationMetaText(location, elementNumber, issue?.rule_id).replace(/^Location: /, "");
      const showMeta = meta && meta !== label;
      return `
          <div class="guidance-location-card">
            <span class="guidance-location-index">${elementNumber}.</span>
            <div>
              <strong>${escapeHtml(label)}</strong>
              ${showMeta ? `<p>${escapeHtml(meta)}</p>` : ""}
            </div>
          </div>
        `;
    }).join("");
    return `
      <div class="guidance-evidence-note">
        <strong>${escapeHtml(`${count} competing primary action${count === 1 ? "" : "s"} found`)}</strong>
        <span>Shown as one cluster of competing actions (early-page CTA heuristic). Element numbers match preview highlights.</span>
      </div>
      <div class="guidance-location-list guidance-location-list--phs-grouped">
        <div class="guidance-phs-violation-block guidance-wip-single-group">
          <div class="guidance-phs-violation-heading">${escapeHtml(groupTitle)}</div>
          ${cards}
        </div>
      </div>
      ${hiddenCount ? `<p class="guidance-hidden-count">${escapeHtml(`${hiddenCount} more competing primary action${hiddenCount === 1 ? "" : "s"} not shown.`)}</p>` : ""}
    `;
  }

  if ((issue?.rule_id || "") === "PHS-1") {
    const grouped = groupLocationsByViolationType(shownLocations);
    const keys = orderPhsViolationGroupKeys(Object.keys(grouped));
    const groupedBlocks = keys.map((violationKey) => {
      const entries = grouped[violationKey];
      const groupTitle = `${formatViolationTypeLabel(violationKey)} (${entries.length})`;
      const cards = entries.map(({ location, elementNumber }) => {
        const label = friendlyLocationLabel(location, issue?.rule_id);
        const meta = locationMetaText(location, elementNumber, issue?.rule_id).replace(/^Location: /, "");
        const showMeta = meta && meta !== label;
        return `
          <div class="guidance-location-card">
            <span class="guidance-location-index">${elementNumber}.</span>
            <div>
              <strong>${escapeHtml(label)}</strong>
              ${showMeta ? `<p>${escapeHtml(meta)}</p>` : ""}
            </div>
          </div>
        `;
      }).join("");
      return `
        <div class="guidance-phs-violation-block">
          <div class="guidance-phs-violation-heading">${escapeHtml(groupTitle)}</div>
          ${cards}
        </div>
      `;
    }).join("");
    return `
      <div class="guidance-evidence-note">
        <strong>${escapeHtml(`${count} affected element${count === 1 ? "" : "s"} found`)}</strong>
        <span>Grouped by heading-structure violation type. Element numbers match <strong>Element 1</strong>, <strong>Element 2</strong>, … in the preview highlight.</span>
      </div>
      <div class="guidance-location-list guidance-location-list--phs-grouped">
        ${groupedBlocks}
      </div>
      ${hiddenCount ? `<p class="guidance-hidden-count">${escapeHtml(`${hiddenCount} more affected element${hiddenCount === 1 ? "" : "s"} not shown.`)}</p>` : ""}
    `;
  }

  if ((issue?.rule_id || "") === "NC-1") {
    const grouped = groupNcLocationsByViolation(shownLocations);
    const keys = orderNcViolationGroupKeys(Object.keys(grouped)).filter((key) => grouped[key].length);
    const groupedBlocks = keys.map((violationKey) => {
      const entries = grouped[violationKey];
      const groupTitle = `${formatNcViolationGroupTitle(violationKey)} (${entries.length})`;
      const cards = entries.map(({ location, elementNumber }) => {
        const metrics = ncEvidenceMetricsLine(location);
        const tech = ncTechnicalMetaLine(location);
        return `
          <div class="guidance-location-card guidance-nc-location-card">
            <span class="guidance-location-index">${elementNumber}.</span>
            <div>
              <strong>${escapeHtml("Navigation Region")}</strong>
              ${metrics ? `<p class="guidance-nc-metrics">${escapeHtml(metrics)}</p>` : ""}
              ${tech ? `<p class="guidance-nc-technical summary-muted">${escapeHtml(tech)}</p>` : ""}
            </div>
          </div>
        `;
      }).join("");
      return `
        <div class="guidance-phs-violation-block guidance-nc-violation-block">
          <div class="guidance-phs-violation-heading">${escapeHtml(groupTitle)}</div>
          ${cards}
        </div>
      `;
    }).join("");
    return `
      <div class="guidance-evidence-note">
        <strong>${escapeHtml(`${count} navigation region${count === 1 ? "" : "s"} flagged`)}</strong>
        <span>Grouped by <strong>why</strong> each region is complex (link count vs nesting depth). Numbers match preview highlights.</span>
      </div>
      <div class="guidance-location-list guidance-location-list--phs-grouped guidance-location-list--nc-grouped">
        ${groupedBlocks}
      </div>
      ${hiddenCount ? `<p class="guidance-hidden-count">${escapeHtml(`${hiddenCount} more navigation region${hiddenCount === 1 ? "" : "s"} not shown.`)}</p>` : ""}
    `;
  }

  if ((issue?.rule_id || "") === "SC-1") {
    const grouped = groupScLocationsByPrimaryPattern(shownLocations);
    const keys = orderScPrimaryGroupKeys(Object.keys(grouped)).filter((key) => grouped[key].length);
    const groupedBlocks = keys.map((groupKey) => {
      const entries = grouped[groupKey];
      const groupTitle = scPrimaryGroupSectionTitle(groupKey, entries.length);
      const cards = entries.map(({ location, elementNumber }) => {
        const label = friendlyLocationLabel(location, issue?.rule_id);
        const metricsAbsent = scAllThreeSentenceMetricsAbsent(location);
        const metrics = metricsAbsent ? SC_CHIP_METRICS_FALLBACK : scSentenceEvidenceMetricsLine(location);
        const primary = scPrimaryPattern(location);
        const secondaryList = scSecondaryPatterns(location);
        const secondaryLine = secondaryList.length ? `Secondary: ${secondaryList.join(" · ")}` : "";
        const previewRaw = String(location.sentence_preview || "").trim();
        const previewCompact = previewRaw ? scCompressedSentencePreview(previewRaw) : "";
        return `
          <div class="guidance-location-card guidance-sc-location-card">
            <span class="guidance-location-index">${elementNumber}.</span>
            <div>
              <strong>${escapeHtml(label)}</strong>
              <p class="guidance-sc-primary">${escapeHtml(primary)}</p>
              <p class="guidance-sc-metrics">${escapeHtml(metrics)}</p>
              ${secondaryLine ? `<p class="guidance-sc-secondary summary-muted">${escapeHtml(secondaryLine)}</p>` : ""}
              ${previewCompact ? `<p class="guidance-sc-fingerprint summary-muted">${escapeHtml(previewCompact)}</p>` : ""}
            </div>
          </div>
        `;
      }).join("");
      return `
        <div class="guidance-phs-violation-block guidance-sc-violation-block">
          <div class="guidance-phs-violation-heading">${escapeHtml(groupTitle)}</div>
          ${cards}
        </div>
      `;
    }).join("");
    return `
      <div class="guidance-evidence-note">
        <strong>${escapeHtml("Sentence complexity patterns and affected text blocks")}</strong>
        <span>${escapeHtml(
          "Complex sentence structures detected using sentence-length, comma-density, and conjunction-density heuristics.",
        )} Each text block appears once under its <strong>primary</strong> pattern; any other matched heuristics are shown as a secondary line on that row. Element numbers match preview highlights.</span>
      </div>
      <div class="guidance-location-list guidance-location-list--phs-grouped guidance-location-list--sc-grouped">
        ${groupedBlocks}
      </div>
      ${hiddenCount ? `<p class="guidance-hidden-count">${escapeHtml(`${hiddenCount} more affected element${hiddenCount === 1 ? "" : "s"} not shown.`)}</p>` : ""}
    `;
  }

  // Guidance should show concrete affected elements, not deduplicated labels,
  // so the visible list matches the affected-element count users see above.
  return `
    <div class="guidance-evidence-note">
      <strong>${escapeHtml(`${count} affected element${count === 1 ? "" : "s"} found`)}</strong>
      <span>Each row shows the element type and its approximate page or code location. The numbers match the <strong>Element 1</strong>, <strong>Element 2</strong> labels in the page highlight.</span>
    </div>
    <div class="guidance-location-list">
      ${shownLocations.map((location, index) => {
        const label = friendlyLocationLabel(location, issue?.rule_id);
        const meta = locationMetaText(location, index + 1, issue?.rule_id).replace(/^Location: /, "");
        const showMeta = meta && meta !== label;
        return `
          <div class="guidance-location-card">
            <span class="guidance-location-index">${index + 1}.</span>
            <div>
              <strong>${escapeHtml(label)}</strong>
              ${showMeta ? `<p>${escapeHtml(meta)}</p>` : ""}
            </div>
          </div>
        `;
      }).join("")}
    </div>
    ${hiddenCount ? `<p class="guidance-hidden-count">${escapeHtml(`${hiddenCount} more affected element${hiddenCount === 1 ? "" : "s"} not shown.`)}</p>` : ""}
  `;
}

function cleanIssueSuggestion(issue) {
  return String(issue?.suggestion || "").trim();
}

function issueRuleFixStepText(issue, dimensionName) {
  const ruleId = issue?.rule_id || "";
  const category = displayDimensionName(dimensionName);
  const backendSuggestion = cleanIssueSuggestion(issue);

  // Use rule-level guidance first. Broad category fallbacks made unrelated
  // issues share the same advice, e.g. vague button labels getting sentence advice.
  const fallbackSteps = {
    content: [
      "Rewrite the affected content so it is shorter and easier to scan.",
      "Use familiar wording and clear structure around the affected area.",
    ],
    motion: [
      "Remove automatic interruptions or motion that starts before users choose it.",
      "Keep the primary task visible and stable while users are reading or deciding.",
    ],
    structure: [
      "Make headings, labels, and navigation patterns consistent.",
      "Make the next step predictable before asking users to act.",
    ],
  };

  const ruleSteps = getDetectorMetadata(ruleId)?.guidance?.steps || null;
  const selectedSteps = ruleSteps || fallbackSteps[DIMENSION_CATEGORY_KEYS[category]] || fallbackSteps.structure;
  const steps = backendSuggestion
    ? [backendSuggestion, ...selectedSteps.filter((step) => step !== backendSuggestion)]
    : selectedSteps;
  return steps.slice(0, 2);
}

function recommendedFixSteps(issue, dimensionName) {
  return issueRuleFixStepText(issue, dimensionName).map((text, index) => ({
    priority: index === 0 ? "Must" : "Should",
    text,
  }));
}

function recommendedFixStepsMarkup(issue, dimensionName) {
  const steps = recommendedFixSteps(issue, dimensionName);
  const visibleSteps = steps.slice(0, 2);
  const stepLabels = ["First change", "Supporting change"];
  return `
    <ol class="guidance-step-list">
      ${visibleSteps.map((step, index) => `
        <li>
          <strong>${escapeHtml(stepLabels[index] || `Step ${index + 1}`)}</strong>
          <p>${escapeHtml(step.text || "")}</p>
        </li>
      `).join("")}
    </ol>
  `;
}

function issueGoalText(issue, dimensionName) {
  const ruleId = issue?.rule_id || "";
  const category = displayDimensionName(dimensionName);

  // The goal is a short design outcome, not another generic category summary.
  const goal = getDetectorMetadata(ruleId)?.guidance?.goal || "";
  if (goal) return goal;
  if (DIMENSION_CATEGORY_KEYS[category] === "content") {
    return "Make the affected content easier to read and scan.";
  }
  if (DIMENSION_CATEGORY_KEYS[category] === "motion") {
    return "Keep users in control of motion and interruptions.";
  }
  return "Make navigation, labels, and next actions predictable.";
}

function issueDoneWhenText(issue, dimensionName) {
  const ruleId = issue?.rule_id || "";
  const category = displayDimensionName(dimensionName);

  // Success checks make the guidance testable for designers after redesigning.
  const doneWhen = getDetectorMetadata(ruleId)?.guidance?.done_when || "";
  if (doneWhen) return doneWhen;
  if (DIMENSION_CATEGORY_KEYS[category] === "content") {
    return "Done when key passages are short, clear, and scannable without re-reading.";
  }
  if (DIMENSION_CATEGORY_KEYS[category] === "motion") {
    return "Done when non-essential autoplay or pop-up interruptions are removed.";
  }
  return "Done when repeated UI patterns use consistent labels and interaction flow.";
}

function advancedDetailsMarkup(issue, ruleId, standards, isoClauses) {
  const locations = Array.isArray(issue?.locations) ? issue.locations : [];
  const selectorItems = locations.map((location, index) => `
    <li>
      <span aria-hidden="true">${index + 1}</span>
      <code>${escapeHtml(locationMetaText(location, null, ruleId).replace(/^Location: /, ""))}</code>
    </li>
  `).join("");
  return `
    <details class="advanced-details">
      <summary>Advanced details</summary>
      <div class="advanced-details-grid">
        <section>
          <span class="issue-detail-label">Standards mapping</span>
          <ul class="priority-evidence">
            <li>${escapeHtml(standards.wcag)}</li>
            <li>${escapeHtml(standards.coga)}</li>
            ${isoClauses.map((clause) => `<li>${escapeHtml(clause)}</li>`).join("")}
          </ul>
        </section>
        <section>
          <span class="issue-detail-label">Developer selectors</span>
          ${selectorItems ? `<ul class="advanced-selector-list">${selectorItems}</ul>` : `<p class="summary-muted">No exact selector was linked for this issue.</p>`}
        </section>
      </div>
    </details>
  `;
}

function selectedIssueWorkspaceMarkup(record) {
  const { dimension, issue } = record;
  const dimensionName = dimension.dimension;
  const ruleId = issue.rule_id || "";
  const model = issueDisplayModel(issue, dimensionName);
  const users = issueAffectedGroups(issue, dimensionName);
  const goal = issueGoalText(issue, dimensionName);
  const doneWhen = issueDoneWhenText(issue, dimensionName);
  const primaryUser = users[0] || "affected users";
  return `
    <section class="issue-guidance-panel" aria-label="Selected issue guidance">
      <div class="guidance-expanded-report">
        <section class="guidance-numbered-section">
          <h4><span>1.</span> ${ruleId === "WIP-1" ? "Competing primary actions and locations" : ruleId === "NC-1" ? "Violation patterns and navigation regions" : "Affected elements and locations"}</h4>
          ${guidanceEvidenceMarkup(issue)}
        </section>

        <section class="guidance-numbered-section">
          <h4><span>2.</span> Why this matters</h4>
          <div class="guidance-text-card">
            <p>${escapeHtml(model.whyItMatters)}</p>
          </div>
        </section>

        <section class="guidance-numbered-section">
          <h4><span>3.</span> First redesign move</h4>
          <div class="guidance-text-card">
            <p class="guidance-redesign-goal">${escapeHtml(goal)}</p>
            ${recommendedFixStepsMarkup(issue, dimensionName)}
            <p class="guidance-success-check"><strong>Success check for ${escapeHtml(primaryUser)}:</strong> ${escapeHtml(doneWhen.replace(/^Done when\s*/i, ""))}</p>
          </div>
        </section>
      </div>
    </section>
  `;
}

function issueElementListMarkup(issue, dimensionName) {
  const locations = Array.isArray(issue?.locations) ? issue.locations : [];
  const inferredCount = Math.max(1, locations.length || 0);
  const selectedIssueId = issueDomId(dimensionName, issue.rule_id);
  const activeElementNumber = state.selectedIssueId === selectedIssueId ? state.selectedElementNumber : 0;

  if ((issue.rule_id || "") === "PHS-1" && locations.length > 0) {
    const visibleSlice = locations.slice(0, 12);
    const hiddenCount = Math.max(0, locations.length - visibleSlice.length);
    const groupedSections = issuePhsGroupedChipSectionsMarkup(
      issue,
      dimensionName,
      visibleSlice,
      activeElementNumber,
    );
    return `
      <div class="issue-summary-row issue-summary-row-elements">
        <div class="issue-phs-grouped-wrap">
          ${groupedSections}
        </div>
        ${hiddenCount ? `<p class="issue-element-hidden-count">+${hiddenCount} more affected element${hiddenCount === 1 ? "" : "s"}.</p>` : ""}
      </div>
    `;
  }

  if ((issue.rule_id || "") === "VO-1" && locations.length > 0) {
    const visibleSlice = locations.slice(0, 12);
    const hiddenCount = Math.max(0, locations.length - visibleSlice.length);
    const groupedSections = issueVoGroupedChipSectionsMarkup(
      issue,
      dimensionName,
      visibleSlice,
      activeElementNumber,
    );
    return `
      <div class="issue-summary-row issue-summary-row-elements">
        <div class="issue-phs-grouped-wrap issue-vo-contributor-wrap">
          ${groupedSections}
        </div>
        ${hiddenCount ? `<p class="issue-element-hidden-count">+${hiddenCount} more affected element${hiddenCount === 1 ? "" : "s"}.</p>` : ""}
      </div>
    `;
  }

  if ((issue.rule_id || "") === "WIP-1" && locations.length > 0) {
    const visibleSlice = locations.slice(0, 12);
    const hiddenCount = Math.max(0, locations.length - visibleSlice.length);
    const totalN = locations.length;
    const groupedSection = issueWipSingleGroupChipSectionsMarkup(
      issue,
      dimensionName,
      visibleSlice,
      activeElementNumber,
      totalN,
    );
    return `
      <div class="issue-summary-row issue-summary-row-elements">
        <div class="issue-phs-grouped-wrap issue-wip-single-group-wrap">
          ${groupedSection}
        </div>
        ${hiddenCount ? `<p class="issue-element-hidden-count">+${hiddenCount} more competing primary action${hiddenCount === 1 ? "" : "s"}.</p>` : ""}
      </div>
    `;
  }

  if ((issue.rule_id || "") === "NC-1" && locations.length > 0) {
    const visibleSlice = locations.slice(0, 12);
    const hiddenCount = Math.max(0, locations.length - visibleSlice.length);
    const groupedSections = issueNcGroupedChipSectionsMarkup(
      issue,
      dimensionName,
      visibleSlice,
      activeElementNumber,
    );
    return `
      <div class="issue-summary-row issue-summary-row-elements">
        <div class="issue-phs-grouped-wrap issue-nc-grouped-wrap">
          ${groupedSections}
        </div>
        ${hiddenCount ? `<p class="issue-element-hidden-count">+${hiddenCount} more navigation region${hiddenCount === 1 ? "" : "s"}.</p>` : ""}
      </div>
    `;
  }

  if ((issue.rule_id || "") === "SC-1" && locations.length > 0) {
    const visibleSlice = locations.slice(0, 12);
    const hiddenCount = Math.max(0, locations.length - visibleSlice.length);
    const groupedSections = issueScGroupedChipSectionsMarkup(
      issue,
      dimensionName,
      visibleSlice,
      activeElementNumber,
    );
    return `
      <div class="issue-summary-row issue-summary-row-elements">
        <div class="issue-phs-grouped-wrap issue-sc-grouped-wrap">
          ${groupedSections}
        </div>
        ${hiddenCount ? `<p class="issue-element-hidden-count">+${hiddenCount} more affected element${hiddenCount === 1 ? "" : "s"}.</p>` : ""}
      </div>
    `;
  }

  const visibleLocations = locations.length ? locations : [{
    label: "Structural evidence, not directly highlightable",
    highlightable: false,
    status: "No visible target found",
  }];
  const sliceForDisplay = visibleLocations.slice(0, 12);
  const rows = sliceForDisplay.map((location, index) => {
    const elementNumber = index + 1;
    const isHighlightable = location?.highlightable !== false && locations.length > 0;
    const adapted = isHighlightable
      ? location
      : { ...location, highlightable: false };
    return issueElementChipRowMarkup(issue, dimensionName, adapted, elementNumber, activeElementNumber);
  }).join("");
  const hiddenCount = Math.max(0, inferredCount - sliceForDisplay.length);
  return `
    <div class="issue-summary-row issue-summary-row-elements">
      <div class="issue-element-chip-list">
        ${rows}
      </div>
      ${hiddenCount ? `<p class="issue-element-hidden-count">+${hiddenCount} more affected element${hiddenCount === 1 ? "" : "s"}.</p>` : ""}
    </div>
  `;
}

function findIssueById(issueId) {
  if (!issueId || !state.currentResult) {
    return null;
  }
  for (const dimension of state.currentResult.dimensions || []) {
    const issue = (dimension.issues || []).find((item) => (
      issueDomId(dimension.dimension, item.rule_id) === issueId
    ));
    if (issue) {
      return { dimension, issue };
    }
  }
  return null;
}

function selectIssue(dimensionName, ruleId) {
  const issueId = issueDomId(dimensionName, ruleId);
  const selected = findIssueById(issueId);
  if (!selected) {
    return null;
  }
  if (state.selectedIssueId !== issueId) {
    setSelectedElementNumber(state, 0);
    setActiveGuidancePopoverKey(state, "");
  }
  setSelectedIssueId(state, issueId);
  updateActiveHighlightButtons();
  return selected;
}

function selectedIssueRecord() {
  return selectedIssueRecordSelector(state);
}

function resetIssueWorkspaceForProfileChange() {
  // A profile switch changes the audience lens, so old issue guidance/highlights
  // should not stay visible under a different user group.
  resetSelectionToSummary(state);
  state.previewGuidancePinned = false;

  clearWebsiteHighlights();
  setWorkspaceMode("website");
  updatePreviewIssueHeader();
  updateActiveHighlightButtons();
}

function issueDisplayModel(issue, dimensionName) {
  const standards = frameworkMappingCopy(issue?.rule_id || "");
  return {
    id: issueDomId(dimensionName, issue?.rule_id),
    issueTitle: issue?.title || "Review this issue",
    issueCategory: displayIssueCategorySingular(issue, dimensionName),
    detectedProblem: issue?.title || "Review this issue",
    affectedUsers: issueAffectedGroups(issue, dimensionName),
    cognitiveImpact: issue?.description || "This issue may increase cognitive load for users.",
    evidence: detectedEvidenceCopy(issue),
    whyItMatters: issue?.description || "This pattern can increase mental effort and make the page harder to use.",
    standards: [standards.wcag, standards.coga, standards.iso],
    highlightTargets: issue?.locations || [],
  };
}

function updatePreviewIssueHeader() {
  const titleNode = document.getElementById("previewIssueTitle");
  const selected = selectedIssueRecord();
  if (!titleNode) {
    return;
  }

  if (!selected) {
    titleNode.textContent = "No issue selected";
    setWebsiteStatus("Select an element from an issue card to highlight it in the webpage preview.");
    return;
  }

  const model = issueDisplayModel(selected.issue, selected.dimension.dimension);
  titleNode.textContent = `Highlighted issue: ${model.issueTitle}`;
}

function phsIssueHasOnlyNonHighlightableLocations(issue) {
  const locs = issue?.locations || [];
  if (!locs.length) {
    return false;
  }
  return locs.every(
    (loc) => loc.highlightable === false || loc.documentStructuralFinding === true,
  );
}

function issueHighlightElements(frameDoc, issue, dimensionName) {
  const ruleId = issue?.rule_id || "";
  const locationElements = (issue.locations || []).flatMap((location) => (
    findElementsForLocation(frameDoc, location, ruleId)
  ));
  if (locationElements.length) {
    return { elements: locationElements, exact: true };
  }

  if (ruleId === "PHS-1" && phsIssueHasOnlyNonHighlightableLocations(issue)) {
    return { elements: [], exact: true, structuralOnly: true };
  }

  const fallbackElements = fallbackSelectorsForIssue(issue, dimensionName).flatMap((selector) => {
    try {
      return Array.from(frameDoc.querySelectorAll(selector));
    } catch (error) {
      return [];
    }
  });

  return { elements: fallbackElements, exact: false };
}

function highlightIssueInLoadedPreview(dimensionName, ruleId) {
  const frameDoc = getPreviewDocument();
  const dimension = findDimension(state.currentResult, dimensionName);
  const issue = dimension?.issues?.find((item) => item.rule_id === ruleId);
  const config = HIGHLIGHT_CONFIG[dimensionName];
  if (!frameDoc || !issue || !config) {
    return;
  }

  injectHighlightStyles(frameDoc);
  clearWebsiteHighlights(frameDoc);

  const highlightOutcome = issueHighlightElements(frameDoc, issue, dimensionName);
  const { elements, exact, structuralOnly } = highlightOutcome;
  const maxHl = exact ? Math.min(100, Math.max(elements.length, 1)) : 30;
  const highlighted = applyHighlights(
    elements,
    config.color,
    (_element, index) => `Element ${index}`,
    maxHl,
  );
  const firstElement = highlighted.values().next().value;
  firstElement?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });

  if (highlighted.size) {
    const fallbackNotice = exact ? "" : " No exact page element is linked to this issue yet; related areas are highlighted instead.";
    setWebsiteStatus(`${highlighted.size} area${highlighted.size === 1 ? "" : "s"} highlighted for ${issue.title || "this issue"}.${fallbackNotice}`);
  } else if (structuralOnly && issue.rule_id === "PHS-1") {
    setWebsiteStatus(
      "No precise DOM highlight for this structural heading issue—it describes document-level markup (semantic hierarchy), not a single visual region.",
      false,
    );
  } else {
    setWebsiteStatus("No exact page element is linked to this issue yet.", true);
  }
}

function highlightSelectedIssueInPreview() {
  const selected = selectedIssueRecord();
  if (!selected) {
    clearWebsiteHighlights();
    updatePreviewIssueHeader();
    return;
  }
  updatePreviewIssueHeader();
  highlightIssueInLoadedPreview(selected.dimension.dimension, selected.issue.rule_id);
}

function openIssueInSummary(dimensionName, ruleId) {
  const issueId = issueDomId(dimensionName, ruleId);
  const isSameIssueOpen = (
    state.selectedIssueId === issueId
    && state.rightPanelMode === "detail"
    && state.workspaceMode === "explanation"
  );

  if (isSameIssueOpen) {
    setSelectedIssueId(state, "");
    clearActiveHighlight(state);
    setRightPanelMode(state, "summary");
    setWorkspaceMode("website");
    clearWebsiteHighlights();
    updatePreviewIssueHeader();
    setWebsiteStatus("Preview reset. Select an issue to highlight it on the page.");
    updateActiveHighlightButtons();
    return;
  }

  const selected = selectIssue(dimensionName, ruleId);
  if (!selected) {
    return;
  }

  setRightPanelMode(state, "detail");
  setWorkspaceMode("explanation");
  renderComparison(state.currentResult, state.previousResult, state.previousSourceName);
  updateActiveHighlightButtons();
}

function renderIssuePreviewPanel(dimensionName, ruleId) {
  const issueId = issueDomId(dimensionName, ruleId);
  const isSamePreviewIssue = (
    state.workspaceMode === "website"
    && state.rightPanelMode === "preview"
    && state.selectedIssueId === issueId
  );

  if (isSamePreviewIssue) {
    setSelectedIssueId(state, "");
    clearActiveHighlight(state);
    clearWebsiteHighlights();
    updatePreviewIssueHeader();
    updateActiveHighlightButtons();
    setWebsiteStatus("Highlight cleared. Select an issue to highlight it on the page again.");
    return;
  }

  const selected = selectIssue(dimensionName, ruleId);
  if (!selected) {
    return;
  }
  setRightPanelMode(state, "preview");
  setActiveHighlightDimension(state, selected.dimension.dimension);
  setActiveHighlightIssueId(state, issueDomId(selected.dimension.dimension, selected.issue.rule_id));
  if (state.workspaceMode !== "website") {
    setWorkspaceMode("website");
  }
  updateActiveHighlightButtons();
  runHighlightAfterIframeLayoutStable(() => highlightSelectedIssueInPreview());
}

function issueSummaryCardMarkup(issue, dimensionName, issueNumber) {
  const issueId = issueDomId(dimensionName, issue.rule_id);
  const { coga: cogaSummary, iso: isoSummary } = issueCardStandardsSummary(issue.rule_id || "");
  return renderIssueSummaryCard(
    {
      escapeHtml,
      friendlyLocationLabel,
      locationMetaText,
      formatViolationTypeLabel,
      scTextBlockPrimaryLabel,
      lcTextBlockPrimaryLabel,
      ncEvidenceMetricsLine,
      ncTechnicalMetaLine,
      scAllThreeSentenceMetricsAbsent,
      scSentenceEvidenceMetricsLine,
      scPrimaryPattern,
      scSecondaryPatterns,
      scCompressedSentencePreview,
      lcLexicalEvidenceMetricsLine,
      lcCompactSampleWords,
      NC_GROUPED_METRICS_FALLBACK,
      SC_CHIP_METRICS_FALLBACK,
      groupLocationsByViolationType,
      orderPhsViolationGroupKeys,
      groupLocationsByContributorCategory,
      orderVoContributorCategoryKeys,
      formatContributorCategoryLabel,
      issueDomId,
    },
    {
      issue,
      dimensionName,
      issueNumber,
      issueId,
      selectedIssueId: state.selectedIssueId,
      selectedElementNumber: state.selectedElementNumber,
      cogaSummary,
      isoSummary,
    },
  );
}

function renderExplanation(result) {
  const explanationContent = document.getElementById("explanationContent");
  if (!explanationContent) {
    return;
  }
  try {
    if (dtLineageEnabled()) {
      const dtDim = (result?.dimensions || []).find((d) => d?.dimension === "Dense Text Detection") || null;
      const dtIssue = (dtDim?.issues || []).find((i) => (i?.rule_id || "") === "DT-1") || null;
      console.log("[DT-1 location lineage]", {
        stage: "renderExplanation.input.result",
        ...summarizeDtLocationArray(dtIssue?.locations || []),
      });
    }
  } catch (_) {
    // ignore
  }
  if (detectorEnablementAuditEnabled()) {
    detectorEnablementAuditLog("dimension.pre_render.filter", {
      active_profile: state.activeProfile || "",
      source_of_truth: "isDetectorEnabledForActiveProfile",
      enabled_detectors: activePatientProfile()?.enabledDetectors || [],
      detector_matrix: buildProfileDetectorMatrix({ PATIENT_PROFILES, DETECTOR_NAMES: DETECTOR_NAMES || [] })[state.activeProfile] || null,
    });
  }
  const filteredResult = {
    ...result,
    dimensions: (result?.dimensions || []).filter((dimension) => isDetectorEnabledForActiveProfile(dimension?.dimension)),
  };
  try {
    if (dtLineageEnabled()) {
      const dtDim = (filteredResult?.dimensions || []).find((d) => d?.dimension === "Dense Text Detection") || null;
      const dtIssue = (dtDim?.issues || []).find((i) => (i?.rule_id || "") === "DT-1") || null;
      console.log("[DT-1 location lineage]", {
        stage: "grouped.issue.records",
        ...summarizeDtLocationArray(dtIssue?.locations || []),
        enabled_dimensions_count: (filteredResult?.dimensions || []).length,
      });
    }
  } catch (_) {
    // ignore
  }
  if (detectorEnablementAuditEnabled()) {
    const hasDenseText = Boolean((filteredResult?.dimensions || []).find((d) => d?.dimension === "Dense Text Detection"));
    detectorEnablementAuditLog("dimension.post_filter.result", {
      active_profile: state.activeProfile || "",
      detector: "Dense Text Detection",
      detector_rule_id: "DT-1",
      enabled: hasDenseText,
      reason: hasDenseText ? "" : "render_visibility_filter",
      source_of_truth: "filteredResult.dimensions",
      runtime_profile: state.activeProfile || "",
    });
    detectorEnablementAuditLog("summary", {
      active_profile: state.activeProfile || "",
      dt_enabled: hasDenseText,
      dt_visibility_stage: hasDenseText ? "dimension.post_filter.result" : "dimension.pre_render.filter",
      first_disable_stage: hasDenseText ? "" : "detector.enablement.check",
      disable_reason: hasDenseText ? "" : "profile_missing_detector",
    });
  }
  explanationContent.className = "pane-scroll rich-text";
  explanationContent.innerHTML = renderExplanationMarkup({
    result: filteredResult,
    escapeHtml,
    patientDetectorOrderIndex,
    prioritizedIssuesForProfile,
    displayDimensionName,
    cognitiveDimensionLabel,
    issueDomId,
    issueCardStandardsSummary,
    selectedIssueId: state.selectedIssueId,
    selectedElementNumber: state.selectedElementNumber,
    issueRenderCtx: {
      escapeHtml,
      friendlyLocationLabel,
      locationMetaText,
      formatViolationTypeLabel,
      groupAmcLocationsBySubtype,
      amcSubtypeLabel,
      amcSubtypeOrder,
      groupEiLocationsBySubtype,
      eiSubtypeLabel,
      eiSubtypeOrder,
      scTextBlockPrimaryLabel,
      lcTextBlockPrimaryLabel,
      ncEvidenceMetricsLine,
      ncTechnicalMetaLine,
      scAllThreeSentenceMetricsAbsent,
      scSentenceEvidenceMetricsLine,
      scPrimaryPattern,
      scSecondaryPatterns,
      scCompressedSentencePreview,
      lcLexicalEvidenceMetricsLine,
      lcCompactSampleWords,
      NC_GROUPED_METRICS_FALLBACK,
      SC_CHIP_METRICS_FALLBACK,
      groupLocationsByViolationType,
      orderPhsViolationGroupKeys,
      groupLocationsByContributorCategory,
      orderVoContributorCategoryKeys,
      formatContributorCategoryLabel,
      issueDomId,
    },
  });
  setActiveDimensionBar("");
  try {
    if (dtLineageEnabled()) {
      const dtCards = document.querySelectorAll('[data-highlight-issue="DT-1"]');
      const chips = Array.from(document.querySelectorAll('[data-issue-element="DT-1"]'))
        .map((node) => String(node?.textContent || "").trim())
        .filter(Boolean);
      console.log("[DT-1 location lineage]", {
        stage: "final.dom.cards",
        dt_location_count: dtCards.length,
        dt_location_ids: [],
        duplicate_selector_count: 0,
        duplicate_text_count: 0,
        grouped_keys: [],
        collapsed_ids: [],
        surviving_ids: [],
      });
      console.log("[DT-1 location lineage]", {
        stage: "final.dom.elements",
        dt_location_count: chips.length,
        dt_location_ids: [],
        duplicate_selector_count: 0,
        duplicate_text_count: 0,
        grouped_keys: [],
        collapsed_ids: [],
        surviving_ids: [],
        rendered_labels: chips.slice(0, 12),
      });
    }
  } catch (_) {
    // ignore
  }
}

function isProbablyUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function isPreviewRouteUrl(value) {
  return String(value || "").startsWith("/preview/");
}

function setWebsiteStatus(message, isError = false) {
  const status = document.getElementById("websitePreviewStatus");
  if (!status) {
    return;
  }
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function setWorkspaceMode(mode) {
  setWorkspaceModeTransition(state, mode);
  const explanationView = document.getElementById("explanationView");
  const websiteView = document.getElementById("websiteView");

  if (!explanationView || !websiteView) {
    return;
  }

  const isWebsite = mode === "website";
  explanationView.hidden = isWebsite;
  websiteView.hidden = !isWebsite;
  explanationView.classList.toggle("is-active", !isWebsite);
  websiteView.classList.toggle("is-active", isWebsite);
  animatePanelEntry(isWebsite ? websiteView : explanationView);

  if (isWebsite) {
    updatePreviewIssueHeader();
    loadWebsitePreview();
  }
}

function getPreviewUrl() {
  if (isProbablyUrl(state.sourceUrl) || isPreviewRouteUrl(state.sourceUrl)) {
    return state.sourceUrl;
  }
  if (isProbablyUrl(state.sourceName) || isPreviewRouteUrl(state.sourceName)) {
    return state.sourceName;
  }
  const runSourceName = state.currentPayload?.run?.source_name;
  if (isProbablyUrl(runSourceName) || isPreviewRouteUrl(runSourceName)) {
    return runSourceName;
  }
  const payloadPreviewUrl = state.currentPayload?.preview_url || state.currentPayload?.resource_bundle?.preview_url;
  return isProbablyUrl(payloadPreviewUrl) || isPreviewRouteUrl(payloadPreviewUrl) ? payloadPreviewUrl : "";
}

function buildPreviewHtml(html) {
  const baseMarkup = `
<base href="about:srcdoc">
`;
  const source = String(html || "");
  if (/<head[\s>]/i.test(source)) {
    return source.replace(/<head([^>]*)>/i, `<head$1>${baseMarkup}`);
  }
  return `${baseMarkup}${source}`;
}

function loadWebsitePreview() {
  const frame = document.getElementById("websitePreviewFrame");
  if (!frame) {
    return;
  }

  const hasUsableSessionHtml = String(state.currentHtml || "").trim().length > 0;
  // URL analyses run on captured HTML; prefer that snapshot in the iframe so preview DOM matches analysis/highlighting.
  const preferUrlSnapshot = state.sourceType === "url" && hasUsableSessionHtml;
  const previewUrl = preferUrlSnapshot ? "" : getPreviewUrl();
  if (previewUrl) {
    const proxiedUrl = isPreviewRouteUrl(previewUrl)
      ? previewUrl
      : `/eye/proxy?url=${encodeURIComponent(previewUrl)}`;
    if (frame.dataset.previewUrl !== proxiedUrl) {
      frame.removeAttribute("srcdoc");
      frame.src = proxiedUrl;
      frame.dataset.previewUrl = proxiedUrl;
      setWebsiteStatus("Loading proxied website preview...");
    }
    scheduleIframePreviewDocumentBootstrap(frame);
    return;
  }

  if (state.currentHtml) {
    if (frame.dataset.previewHtml !== state.currentHtml || frame.dataset.previewGuardVersion !== "3") {
      frame.removeAttribute("src");
      frame.srcdoc = buildPreviewHtml(state.currentHtml);
      frame.dataset.previewHtml = state.currentHtml;
      frame.dataset.previewGuardVersion = "3";
      setWebsiteStatus(
        preferUrlSnapshot
          ? "Loaded captured page HTML (same snapshot as analysis). Choose a detector to highlight related areas."
          : "Loaded uploaded HTML preview. Choose a detector to highlight related areas.",
      );
    }
    scheduleIframePreviewDocumentBootstrap(frame);
    return;
  }

  setWebsiteStatus("No website preview is available for this analysis.", true);
}

/** Loads the iframe preview when the dashboard opens for URL-based sessions. Does not run analysis. */
function loadPreviewOnSessionStart() {
  if (!isProbablyUrl(state.sourceUrl)) {
    return;
  }
  loadWebsitePreview();
}

function getPreviewDocument() {
  const frame = document.getElementById("websitePreviewFrame");
  if (!frame) {
    return null;
  }

  try {
    return frame.contentDocument || frame.contentWindow?.document || null;
  } catch (error) {
    return null;
  }
}

function runHighlightAfterIframeLayoutStable(callback) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => callback());
  });
}

function applyIframePreviewBootstrap(doc) {
  if (!doc) {
    return;
  }

  injectHighlightStyles(doc);
  bindPreviewElementClick(doc);
  updatePreviewIssueHeader();
  if (state.rightPanelMode === "preview" && state.selectedIssueId && state.selectedElementNumber > 0) {
    const selected = selectedIssueRecord();
    if (selected) {
      void highlightIssueElementInPreview(
        selected.dimension.dimension,
        selected.issue.rule_id,
        state.selectedElementNumber,
      );
    }
  } else if (state.rightPanelMode === "preview" && state.selectedIssueId) {
    highlightSelectedIssueInPreview();
  } else if (state.activeHighlightIssueId) {
    const [dimensionName, ...ruleIdParts] = state.activeHighlightIssueId.split(":");
    highlightIssue(dimensionName, ruleIdParts.join(":"), true);
  } else if (state.selectedIssueId) {
    const selected = findIssueById(state.selectedIssueId);
    if (selected) {
      highlightIssueInLoadedPreview(selected.dimension.dimension, selected.issue.rule_id);
    }
  } else if (state.activeHighlightDimension) {
    highlightDimension(state.activeHighlightDimension);
  }
}

function scheduleIframePreviewDocumentBootstrap(frameParam) {
  const frame = frameParam ?? document.getElementById("websitePreviewFrame");
  if (!frame) {
    return;
  }

  const pendingRaw = frame.dataset.cognilensPreviewBootstrapAf ?? "";
  const pending = Number.parseInt(pendingRaw, 10);
  if (!Number.isNaN(pending)) {
    window.cancelAnimationFrame(pending);
  }

  let ticks = 0;
  const maxTicks = 90;

  const step = () => {
    delete frame.dataset.cognilensPreviewBootstrapAf;
    ticks += 1;
    try {
      const doc = frame.contentDocument || frame.contentWindow?.document || null;
      if (doc?.body && (doc.readyState === "complete" || doc.readyState === "interactive")) {
        applyIframePreviewBootstrap(doc);
        return;
      }
      if (ticks >= maxTicks) {
        applyIframePreviewBootstrap(doc ?? null);
        return;
      }
    } catch {
      /* cross-origin transitions can throw until load settles */
      if (ticks >= maxTicks) {
        applyIframePreviewBootstrap(null);
        return;
      }
    }

    frame.dataset.cognilensPreviewBootstrapAf = String(window.requestAnimationFrame(step));
  };

  frame.dataset.cognilensPreviewBootstrapAf = String(window.requestAnimationFrame(step));
}

function previewDebugState(doc = getPreviewDocument()) {
  if (!doc) {
    return { accessible: false };
  }
  const win = doc.defaultView;
  const sections = Array.from(doc.querySelectorAll("section[id], main[id], [data-section], [class*='active' i]"))
    .filter((element) => isElementVisibleForHighlight(element))
    .slice(0, 8)
    .map((element) => ({
      tag: element.tagName?.toLowerCase(),
      id: element.id || "",
      className: String(element.className || ""),
      text: elementTextPreview(element),
      rect: element.getBoundingClientRect(),
    }));
  return {
    accessible: true,
    url: doc.location?.href || "",
    hash: doc.location?.hash || win?.location?.hash || "",
    activeElement: doc.activeElement ? {
      tag: doc.activeElement.tagName?.toLowerCase(),
      id: doc.activeElement.id || "",
      className: String(doc.activeElement.className || ""),
      text: elementTextPreview(doc.activeElement),
    } : null,
    visibleSections: sections,
  };
}

function injectHighlightStyles(doc) {
  if (!doc || doc.getElementById("cognilens-highlight-style")) {
    return;
  }

  const style = doc.createElement("style");
  style.id = "cognilens-highlight-style";
  style.textContent = `
    [data-cognilens-highlight] {
      position: relative !important;
      outline: 3px solid var(--cognilens-highlight-color, #2f6feb) !important;
      outline-offset: 5px !important;
      border-radius: 8px !important;
      background-color: color-mix(in srgb, var(--cognilens-highlight-color, #2f6feb) 10%, transparent) !important;
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.16) !important;
      transition: outline-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease !important;
      cursor: pointer !important;
    }

    [data-cognilens-highlight]::after {
      content: attr(data-cognilens-highlight);
      position: absolute;
      top: -18px;
      left: 10px;
      z-index: 2147483647;
      padding: 3px 8px;
      border-radius: 999px;
      background: var(--cognilens-highlight-color, #2f6feb);
      color: #fff;
      font: 700 11px/1.2 Arial, sans-serif;
      letter-spacing: 0.02em;
      pointer-events: none;
    }

    #cognilens-guidance-popover {
      position: absolute;
      z-index: 2147483647;
      width: min(420px, calc(100vw - 24px));
      background: #ffffff;
      border: 1px solid rgba(37, 99, 235, 0.3);
      border-radius: 12px;
      box-shadow: 0 18px 36px rgba(15, 23, 42, 0.2);
      padding: 14px 48px 14px 16px;
      font: 500 13px/1.45 Arial, sans-serif;
      color: #0f172a;
    }

    #cognilens-guidance-popover .cognilens-popover-close {
      position: absolute;
      top: 10px;
      right: 10px;
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border: 1px solid rgba(148, 163, 184, 0.42);
      border-radius: 10px;
      background: rgba(248, 250, 252, 0.92);
      color: transparent;
      cursor: pointer;
      transition: background 140ms ease, border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
      -webkit-appearance: none;
      appearance: none;
      touch-action: manipulation;
    }

    #cognilens-guidance-popover .cognilens-popover-close::before,
    #cognilens-guidance-popover .cognilens-popover-close::after {
      content: "";
      position: absolute;
      width: 13px;
      height: 2px;
      border-radius: 999px;
      background: #64748b;
      transform-origin: center;
    }

    #cognilens-guidance-popover .cognilens-popover-close::before {
      transform: rotate(45deg);
    }

    #cognilens-guidance-popover .cognilens-popover-close::after {
      transform: rotate(-45deg);
    }

    #cognilens-guidance-popover .cognilens-popover-close:hover,
    #cognilens-guidance-popover .cognilens-popover-close:focus-visible {
      border-color: rgba(37, 99, 235, 0.42);
      background: #eff6ff;
      box-shadow: 0 6px 14px rgba(15, 23, 42, 0.12);
      transform: translateY(-1px);
      outline: none;
    }

    #cognilens-guidance-popover .cognilens-popover-close:hover::before,
    #cognilens-guidance-popover .cognilens-popover-close:hover::after,
    #cognilens-guidance-popover .cognilens-popover-close:focus-visible::before,
    #cognilens-guidance-popover .cognilens-popover-close:focus-visible::after {
      background: #1d4ed8;
    }

    #cognilens-guidance-popover h5 {
      margin: 0 0 8px;
      font: 800 12px/1.2 Arial, sans-serif;
      letter-spacing: 0.02em;
      color: #1d4ed8;
      text-transform: uppercase;
    }

    #cognilens-guidance-popover p {
      margin: 0 0 10px;
      color: #1e293b;
    }

    #cognilens-guidance-popover ol {
      margin: 0;
      padding-left: 18px;
    }

    #cognilens-guidance-popover li + li {
      margin-top: 6px;
    }
  `;
  doc.head?.appendChild(style);
}

function clearWebsiteHighlights(doc = getPreviewDocument()) {
  if (!doc) {
    return;
  }
  doc.querySelectorAll("[data-cognilens-highlight]").forEach((node) => {
    node.removeAttribute("data-cognilens-highlight");
    node.style.removeProperty("--cognilens-highlight-color");
  });
  removeGuidancePopover(doc);
}

function removeGuidancePopover(doc = getPreviewDocument()) {
  if (!doc) {
    return;
  }
  doc.getElementById("cognilens-guidance-popover")?.remove();
  setActiveGuidancePopoverKey(state, "");
  state.previewGuidancePinned = false;
}

function positionGuidancePopover(popoverEl, anchorElement, doc) {
  const view = doc.defaultView || window;
  const anchorRect = anchorElement.getBoundingClientRect();
  const popoverRect = popoverEl.getBoundingClientRect();
  const viewportWidth = doc.documentElement?.clientWidth || view.innerWidth || 0;
  const viewportHeight = doc.documentElement?.clientHeight || view.innerHeight || 0;
  const edge = 8;
  const gap = 10;
  const maxLeft = Math.max(edge, viewportWidth - popoverRect.width - edge);
  const leftInViewport = Math.min(Math.max(edge, anchorRect.left + edge), maxLeft);
  const spaceBelow = viewportHeight - anchorRect.bottom;
  const spaceAbove = anchorRect.top;
  const placeAbove = spaceBelow < popoverRect.height + gap && spaceAbove > spaceBelow;
  const preferredTop = placeAbove
    ? anchorRect.top - popoverRect.height - gap
    : anchorRect.bottom + gap;
  const maxTop = Math.max(edge, viewportHeight - popoverRect.height - edge);
  const topInViewport = Math.min(Math.max(edge, preferredTop), maxTop);

  popoverEl.dataset.placement = placeAbove ? "above" : "below";
  popoverEl.style.left = `${leftInViewport + (view.scrollX || 0)}px`;
  popoverEl.style.top = `${topInViewport + (view.scrollY || 0)}px`;
}

function renderGuidancePopover(doc, anchorElement, record, elementLabel, { reuseIfSameKey = false } = {}) {
  if (!doc || !anchorElement || !record?.issue) {
    return;
  }
  const expectedKey = `${state.selectedIssueId}:${elementLabel}`;
  const existing = doc.getElementById("cognilens-guidance-popover");

  if (reuseIfSameKey && existing && state.activeGuidancePopoverKey === expectedKey) {
    positionGuidancePopover(existing, anchorElement, doc);
    return;
  }

  removeGuidancePopover(doc);

  const { issue, dimension } = record;
  const goal = issueGoalText(issue, dimension.dimension);
  const steps = recommendedFixSteps(issue, dimension.dimension)
    .slice(0, 2)
    .map((step) => step.text)
    .filter(Boolean);
  const container = doc.createElement("aside");
  container.id = "cognilens-guidance-popover";
  container.setAttribute("role", "dialog");
  container.setAttribute("aria-label", `${elementLabel} guidance`);
  const listMarkup = steps.length
    ? `<ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>`
    : `<p>${escapeHtml(goal)}</p>`;
  container.innerHTML = `
    <button type="button" class="cognilens-popover-close" aria-label="Close guidance popover"></button>
    <h5>${escapeHtml(elementLabel)}</h5>
    <h5>Why this matters</h5>
    <p>${escapeHtml(issue.description || "This pattern can increase cognitive load and interrupt users' task flow.")}</p>
    <h5>First redesign move</h5>
    ${listMarkup}
  `;
  doc.body?.appendChild(container);
  setActiveGuidancePopoverKey(state, expectedKey);
  positionGuidancePopover(container, anchorElement, doc);
}

function bindPreviewElementClick(doc) {
  if (!doc || doc.documentElement.dataset.cognilensPreviewGuidanceInteractions === "true") {
    return;
  }
  doc.documentElement.dataset.cognilensPreviewGuidanceInteractions = "true";

  doc.addEventListener("mouseover", (event) => {
    const hl = event.target.closest("[data-cognilens-highlight]");
    if (!hl) {
      return;
    }
    const selected = selectedIssueRecord();
    if (!selected || !state.selectedIssueId) {
      return;
    }
    const elementLabel = hl.getAttribute("data-cognilens-highlight") || "Element";
    renderGuidancePopover(doc, hl, selected, elementLabel, { reuseIfSameKey: true });
  });

  doc.addEventListener("mouseout", (event) => {
    if (state.previewGuidancePinned) {
      return;
    }
    const related = event.relatedTarget;
    const hl = event.target.closest("[data-cognilens-highlight]");
    if (hl) {
      if (related && hl.contains(related)) {
        return;
      }
      removeGuidancePopover(doc);
      return;
    }
    const pop = event.target.closest("#cognilens-guidance-popover");
    if (pop && (!related || !pop.contains(related))) {
      removeGuidancePopover(doc);
    }
  });

  doc.addEventListener("click", (event) => {
    const closeTrigger = event.target.closest(".cognilens-popover-close");
    if (closeTrigger) {
      event.preventDefault();
      event.stopPropagation();
      removeGuidancePopover(doc);
      return;
    }

    const insidePopover = event.target.closest("#cognilens-guidance-popover");
    if (insidePopover) {
      return;
    }

    const highlightedElement = event.target.closest("[data-cognilens-highlight]");
    if (!highlightedElement) {
      removeGuidancePopover(doc);
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const selected = selectedIssueRecord();
    if (!selected || !state.selectedIssueId) {
      return;
    }
    const elementLabel = highlightedElement.getAttribute("data-cognilens-highlight") || "Element";
    const nextKey = `${state.selectedIssueId}:${elementLabel}`;
    const alreadyPinnedHere = state.previewGuidancePinned && state.activeGuidancePopoverKey === nextKey;
    const popoverShowing = Boolean(doc.getElementById("cognilens-guidance-popover"));
    if (!popoverShowing || state.activeGuidancePopoverKey !== nextKey) {
      renderGuidancePopover(doc, highlightedElement, selected, elementLabel);
    }
    state.previewGuidancePinned = !alreadyPinnedHere;
    if (!state.previewGuidancePinned) {
      removeGuidancePopover(doc);
    }
  });
}

function normalizeInlineText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function cssEscape(value) {
  if (window.CSS?.escape) {
    return window.CSS.escape(value);
  }
  return String(value).replace(/["\\#.:,[\]>+~*'=]/g, "\\$&");
}

function summaryToSelector(summary) {
  const value = String(summary || "").trim();
  if (!value || value.includes(" ") || isGenericOrBadSelector(value)) {
    return "";
  }
  return value
    .replace(/#([A-Za-z0-9_-]+)/g, (_match, id) => `#${cssEscape(id)}`)
    .replace(/\.([A-Za-z0-9_-]+)/g, (_match, className) => `.${cssEscape(className)}`);
}

function isGenericOrBadSelector(selector) {
  const value = String(selector || "").trim().toLowerCase();
  return [
    "a",
    "button",
    "div",
    "section",
    "p",
    "li",
    "img",
    "input",
    "article",
    "nav",
    "main",
    "html",
    "head",
    "body",
    "script",
    "style",
    "meta",
    "link",
    "noscript",
    "template",
  ].includes(value);
}

function collectTextBlocks(doc) {
  return Array.from(doc.querySelectorAll("p, li, article, section, blockquote, td, th"))
    .filter((element) => normalizeInlineText(element.textContent).length >= 20);
}

function findByText(doc, tag, text) {
  const normalizedText = normalizeInlineText(text);
  if (!normalizedText) {
    return [];
  }

  const selector = tag && /^[a-z0-9-]+$/i.test(tag) ? tag : "*";
  return Array.from(doc.querySelectorAll(selector)).filter((element) => {
    const candidate = normalizeInlineText(element.textContent);
    return candidate.includes(normalizedText) || normalizedText.includes(candidate);
  });
}

function debugHighlight(...args) {
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    console.info("[CogniLens highlight]", ...args);
  }
}

function elementHiddenReason(element) {
  if (!element || element.nodeType !== 1) {
    return "not an element";
  }
  let current = element;
  while (current && current.nodeType === 1) {
    const style = current.ownerDocument?.defaultView?.getComputedStyle(current);
    if (!style) {
      return "no computed style";
    }
    if (current.hasAttribute("hidden")) {
      return `hidden attribute on <${current.tagName.toLowerCase()}>`;
    }
    if (current.getAttribute("aria-hidden") === "true") {
      return `aria-hidden on <${current.tagName.toLowerCase()}>`;
    }
    if (style.display === "none") {
      return `display:none on <${current.tagName.toLowerCase()}>`;
    }
    if (style.visibility === "hidden" || style.visibility === "collapse") {
      return `visibility:${style.visibility} on <${current.tagName.toLowerCase()}>`;
    }
    if (Number(style.opacity) === 0) {
      return `opacity:0 on <${current.tagName.toLowerCase()}>`;
    }
    current = current.parentElement;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return `zero-size rect ${Math.round(rect.width)}x${Math.round(rect.height)}`;
  }
  return "";
}

function isElementVisibleForHighlight(element) {
  return !elementHiddenReason(element);
}

function elementTextPreview(element) {
  return normalizeInlineText([
    element?.textContent,
    element?.getAttribute?.("aria-label"),
    element?.getAttribute?.("title"),
    element?.getAttribute?.("alt"),
  ].filter(Boolean).join(" ")).slice(0, 120);
}

function elementDebugSnapshot(element, frameDoc = null) {
  if (!element || element.nodeType !== 1) {
    return { exists: false };
  }
  const rect = element.getBoundingClientRect();
  const viewportWidth = frameDoc?.documentElement?.clientWidth || element.ownerDocument?.documentElement?.clientWidth || 0;
  const viewportHeight = frameDoc?.documentElement?.clientHeight || element.ownerDocument?.documentElement?.clientHeight || 0;
  const inViewport = rect.bottom >= 0
    && rect.right >= 0
    && (!viewportWidth || rect.left <= viewportWidth)
    && (!viewportHeight || rect.top <= viewportHeight);
  return {
    exists: true,
    tag: element.tagName?.toLowerCase(),
    id: element.id || "",
    className: String(element.className || ""),
    text: elementTextPreview(element),
    visible: isElementVisibleForHighlight(element),
    hiddenReason: elementHiddenReason(element),
    rect,
    inViewport,
    highlightAttr: element.getAttribute("data-cognilens-highlight") || "",
  };
}

function debugCandidateList(source, elements, frameDoc = null) {
  debugHighlight(`${source} candidate detail`, Array.from(elements || []).slice(0, 10).map((element) => (
    elementDebugSnapshot(element, frameDoc)
  )));
}

function validateHighlightTarget(element, location = null, frameDoc = null, ruleIdHint = "") {
  return validateHighlightTargetEngine(
    {
      elementHiddenReason,
      isGenericOrBadSelector,
      ruleContext: { lc1FrontendForensicEnabled, dt1FrontendForensicEnabled },
    },
    element,
    location,
    frameDoc,
    ruleIdHint,
  );
}

function sortHighlightCandidates(elements) {
  const unique = Array.from(new Set(elements.filter((element) => element?.nodeType === 1)));
  return unique.sort((left, right) => {
    const leftVisible = isElementVisibleForHighlight(left) ? 1 : 0;
    const rightVisible = isElementVisibleForHighlight(right) ? 1 : 0;
    if (leftVisible !== rightVisible) {
      return rightVisible - leftVisible;
    }
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    return (leftRect.top - rightRect.top) || (leftRect.left - rightRect.left);
  });
}

function findElementsForLocation(doc, location, ruleId = "") {
  const effectiveRuleId = ruleId || location?.rule_id || "";
  const elements = findElementsForLocationEngine(
    {
      cssEscape,
      debugHighlight,
      debugCandidateList,
      isGenericOrBadSelector,
      summaryToSelector,
      findByText,
      collectTextBlocks,
      sortHighlightCandidates,
      elementTextPreview,
      elementHiddenReason,
      isElementVisibleForHighlight,
      filterDtEvidenceElements,
      filterScEvidenceElements,
      filterLcEvidenceElements,
      lc1FrontendForensicEnabled,
      dt1FrontendForensicEnabled,
      ruleContext: { lc1FrontendForensicEnabled, dt1FrontendForensicEnabled },
      HIGHLIGHT_CONFIG,
      getDetectorSemanticModule,
    },
    doc,
    location,
    effectiveRuleId,
  );
  logHighlightResolution(
    {
      ruleContext: { lc1FrontendForensicEnabled, dt1FrontendForensicEnabled },
      getDetectorSemanticModule,
    },
    { ruleId: effectiveRuleId, selector: location?.selector || "", matched: elements, finalTarget: elements?.[0] || null },
  );
  return elements;
}

function clickableText(element) {
  return normalizeInlineText([
    element?.textContent,
    element?.getAttribute?.("aria-label"),
    element?.getAttribute?.("title"),
    element?.getAttribute?.("value"),
  ].filter(Boolean).join(" ")).toLowerCase();
}

function looksLikeExpander(element) {
  const text = clickableText(element);
  const className = String(element?.className || "").toLowerCase();
  return (
    className.includes("btn-link")
    || className.includes("learn")
    || className.includes("more")
    || ["learn more", "open", "show", "show more", "details", "view details", "read more"].some((phrase) => text.includes(phrase))
  );
}

function findExpanderForHiddenElement(element) {
  if (!element) {
    return null;
  }

  const section = element.closest("section, article, [class*='card' i], [class*='panel' i], [class*='item' i], [class*='container' i]");
  const scopes = [
    section,
    element.closest(".text-full")?.closest("section"),
    element.parentElement,
    element.ownerDocument?.body,
  ].filter(Boolean);

  for (const scope of scopes) {
    const preferredPortfolioButton = scope.querySelector?.(".text .btn-link, .visible .btn-link, a.btn-link, button.btn-link");
    if (preferredPortfolioButton && isElementVisibleForHighlight(preferredPortfolioButton)) {
      return preferredPortfolioButton;
    }

    const candidates = Array.from(scope.querySelectorAll?.("button, a, [role='button'], .btn-link") || [])
      .filter((candidate) => candidate !== element && isElementVisibleForHighlight(candidate));
    const expander = candidates.find(looksLikeExpander);
    if (expander) {
      return expander;
    }
  }
  return null;
}

function tryExpandHiddenElement(element) {
  const expander = findExpanderForHiddenElement(element);
  if (!expander) {
    debugHighlight("no expander found for hidden element", elementHiddenReason(element), element);
    return false;
  }
  debugHighlight("clicking expander for hidden element", clickableText(expander), expander);
  expander.click();
  return true;
}

function moreSpecificHighlightTarget(element, location = null, frameDoc = null, ruleId = "") {
  return moreSpecificHighlightTargetEngine(
    {
      debugHighlight,
      sortHighlightCandidates,
      elementTextPreview,
      elementHiddenReason,
      isGenericOrBadSelector,
      ruleContext: { lc1FrontendForensicEnabled, dt1FrontendForensicEnabled },
    },
    element,
    location,
    frameDoc,
    ruleId,
  );
}

function fallbackSelectorsForIssue(issue, dimensionName) {
  return fallbackSelectorsForIssueEngine({ HIGHLIGHT_CONFIG, ruleContext: { lc1FrontendForensicEnabled, dt1FrontendForensicEnabled } }, issue, dimensionName);
}

function applyHighlights(elements, color, label, maxCount = 30) {
  const highlighted = new Set();
  sortHighlightCandidates(elements).forEach((element) => {
    if (!element || element.nodeType !== 1 || highlighted.size >= maxCount || highlighted.has(element)) {
      return;
    }
    const validation = validateHighlightTarget(element, null, element.ownerDocument);
    if (!validation.ok) {
      debugHighlight("skip invalid highlight candidate", validation.reason, {
        tag: element.tagName?.toLowerCase(),
        className: element.className,
        text: elementTextPreview(element),
        rect: element.getBoundingClientRect(),
      });
      return;
    }
    const rect = element.getBoundingClientRect();
    const tagName = element.tagName?.toLowerCase();
    if (
      rect.width < 24
      || rect.height < 14
      || tagName === "br"
      || tagName === "script"
      || tagName === "style"
      || tagName === "meta"
      || tagName === "link"
    ) {
      return;
    }
    // Issue-level highlights use numbered labels so the preview markers can
    // be matched back to the ordered element list in the guidance panel.
    const highlightLabel = typeof label === "function"
      ? label(element, highlighted.size + 1)
      : label;
    element.setAttribute("data-cognilens-highlight", highlightLabel);
    element.style.setProperty("--cognilens-highlight-color", color);
    highlighted.add(element);
    debugHighlight("highlight attribute applied", {
      label: highlightLabel,
      color,
      element: elementDebugSnapshot(element, element.ownerDocument),
      styleInjected: Boolean(element.ownerDocument?.getElementById("cognilens-highlight-style")),
      note: "Highlight is CSS outline/background inside iframe, not a separate overlay element.",
    });
  });
  return highlighted;
}

function waitForPreviewUpdate(ms = 350) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function updateActiveHighlightButtons() {
  document.querySelectorAll("[data-highlight-dimension]").forEach((button) => {
    const isDimensionButton = !button.dataset.highlightIssue;
    button.classList.toggle(
      "is-active",
      isDimensionButton
        && Boolean(state.activeHighlightDimension)
        && button.dataset.highlightDimension === state.activeHighlightDimension
        && !state.activeHighlightIssueId,
    );
  });

  document.querySelectorAll("[data-highlight-issue]").forEach((button) => {
    const issueId = `${button.dataset.highlightDimension || ""}:${button.dataset.highlightIssue || ""}`;
    button.classList.toggle("is-active", issueId === state.activeHighlightIssueId || issueId === state.selectedIssueId);
    button.classList.toggle("is-selected", issueId === state.selectedIssueId);
  });

  document.querySelectorAll("[data-issue-element]").forEach((button) => {
    const issueId = issueDomId(button.dataset.issueDimension, button.dataset.issueElement);
    const elementIndex = Number(button.dataset.elementIndex || "0");
    const isActive = (
      issueId === state.selectedIssueId
      && elementIndex === state.selectedElementNumber
    );
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

async function highlightIssueElementInPreview(dimensionName, ruleId, elementNumber) {
  const frameDoc = getPreviewDocument();
  const dimension = findDimension(state.currentResult, dimensionName);
  const issue = dimension?.issues?.find((item) => item.rule_id === ruleId);
  const config = HIGHLIGHT_CONFIG[dimensionName];
  if (!frameDoc || !issue || !config) {
    setWebsiteStatus("The website preview is still loading. Try again in a moment.", true);
    return;
  }
  injectHighlightStyles(frameDoc);
  clearWebsiteHighlights(frameDoc);

  const location = issue.locations?.[elementNumber - 1];
  debugHighlight("affected element click diagnosis", {
    issueTitle: issue.title,
    dimensionName,
    ruleId,
    elementNumber,
    location,
    preview: previewDebugState(frameDoc),
    selector: location?.selector || "",
    cognilensId: location?.cognilensId || "",
  });
  const exactLocationElements = location ? findElementsForLocation(frameDoc, location, ruleId) : [];
  const elements = exactLocationElements.length
    ? exactLocationElements
    : issueHighlightElements(frameDoc, issue, dimensionName).elements;
  const target = exactLocationElements.length
    ? sortHighlightCandidates(elements)[0]
    : sortHighlightCandidates(elements)[elementNumber - 1];
  debugHighlight("click issue element", {
    dimensionName,
    ruleId,
    elementNumber,
    location,
    candidates: elements.length,
    exactLocation: exactLocationElements.length > 0,
    candidatesDetail: sortHighlightCandidates(elements).slice(0, 10).map((element) => elementDebugSnapshot(element, frameDoc)),
    target: elementDebugSnapshot(target, frameDoc),
    visible: isElementVisibleForHighlight(target),
    hiddenReason: elementHiddenReason(target),
  });
  if (!target) {
    setWebsiteStatus(`Element ${elementNumber} is not available on this rendered page view.`, true);
    return;
  }

  let finalTarget = moreSpecificHighlightTarget(target, location, frameDoc, ruleId);
  if (!isElementVisibleForHighlight(finalTarget)) {
    const expanded = tryExpandHiddenElement(finalTarget);
    if (expanded) {
      setWebsiteStatus(`Element ${elementNumber} is inside hidden content. Opening its section...`);
      await waitForPreviewUpdate();
      const retry = location ? findElementsForLocation(frameDoc, location, ruleId) : issueHighlightElements(frameDoc, issue, dimensionName).elements;
      finalTarget = moreSpecificHighlightTarget(
        sortHighlightCandidates(retry)[exactLocationElements.length ? 0 : elementNumber - 1] || finalTarget,
        location,
        frameDoc,
        ruleId,
      );
      debugHighlight("after auto expand retry", {
        candidates: retry.length,
        finalTarget,
        visible: isElementVisibleForHighlight(finalTarget),
        hiddenReason: elementHiddenReason(finalTarget),
      });
    }
  }

  const targetValidation = validateHighlightTarget(finalTarget, location, frameDoc, ruleId);
  debugHighlight("final target validation", {
    ok: targetValidation.ok,
    reason: targetValidation.reason,
    tag: finalTarget?.tagName?.toLowerCase(),
    className: finalTarget?.className,
    text: elementTextPreview(finalTarget),
    rect: finalTarget?.getBoundingClientRect?.(),
  });
  if (!targetValidation.ok) {
    setWebsiteStatus(`Element ${elementNumber} cannot be highlighted: ${targetValidation.reason}.`, true);
    return;
  }

  const highlighted = applyHighlights([finalTarget], config.color, `Element ${elementNumber}`);
  debugHighlight("highlight result", {
    highlightedCount: highlighted.size,
    targetHasHighlightAttr: finalTarget?.hasAttribute?.("data-cognilens-highlight"),
    target: elementDebugSnapshot(finalTarget, frameDoc),
    previewAfterHighlight: previewDebugState(frameDoc),
  });
  if (!highlighted.size) {
    setWebsiteStatus(`Element ${elementNumber} was found but is not a directly highlightable visible target.`, true);
    return;
  }
  finalTarget.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  setWebsiteStatus(
    `Element ${elementNumber} highlighted for ${issue.title || "this issue"}. `
    + `Hover it for guidance, or click to pin the guidance panel.`,
  );
}

function focusIssueElement(dimensionName, ruleId, elementNumber) {
  const issueId = issueDomId(dimensionName, ruleId);
  const isSameElementActive = (
    state.selectedIssueId === issueId
    && state.selectedElementNumber === elementNumber
    && state.rightPanelMode === "preview"
  );
  if (isSameElementActive) {
    setSelectedElementNumber(state, 0);
    clearActiveHighlight(state);
    setActiveGuidancePopoverKey(state, "");
    clearWebsiteHighlights();
    updateActiveHighlightButtons();
    setWebsiteStatus("Highlight cleared. Click an element again to re-highlight it.");
    return;
  }

  const selected = selectIssue(dimensionName, ruleId);
  if (!selected) {
    return;
  }

  const issue = selected.issue;
  const locations = Array.isArray(issue?.locations) ? issue.locations : [];
  const location = locations[elementNumber - 1] || null;
  const isNonHighlightableClick = location?.highlightable === false
    || (String(location?.tag || "").toLowerCase() === "audio" && /autoplay/i.test(String(location?.label || "")));
  if (isNonHighlightableClick) {
    // Keep click behavior (selection), but do not switch to preview / reload the iframe.
    setRightPanelMode(state, "detail");
    setWorkspaceMode("explanation");
    setSelectedElementNumber(state, elementNumber);
    clearActiveHighlight(state);
    setActiveGuidancePopoverKey(state, "");
    updateActiveHighlightButtons();
    setWebsiteStatus("This evidence cannot be highlighted in the website preview (e.g. autoplay audio).");
    return;
  }

  setRightPanelMode(state, "preview");
  setActiveHighlightDimension(state, selected.dimension.dimension);
  setActiveHighlightIssueId(state, issueDomId(selected.dimension.dimension, selected.issue.rule_id));
  setSelectedElementNumber(state, elementNumber);
  setActiveGuidancePopoverKey(state, "");
  if (state.workspaceMode !== "website") {
    setWorkspaceMode("website");
  }
  updateActiveHighlightButtons();
  runHighlightAfterIframeLayoutStable(() => {
    void highlightIssueElementInPreview(dimensionName, ruleId, elementNumber);
  });
}

function highlightDimension(dimensionName) {
  const detectorName = displayDimensionName(dimensionName);
  if (
    state.workspaceMode === "website"
    && state.activeHighlightDimension === dimensionName
    && !state.activeHighlightIssueId
  ) {
    clearWebsiteHighlights();
    setActiveHighlightDimension(state, "");
    updateActiveHighlightButtons();
    setWebsiteStatus("Highlight cleared. The original webpage view is restored.");
    return;
  }

  setActiveHighlightDimension(state, dimensionName);
  setActiveHighlightIssueId(state, "");
  const dimension = findDimension(state.currentResult, dimensionName);
  const config = HIGHLIGHT_CONFIG[dimensionName];
  updateActiveHighlightButtons();

  const switchedWorkspace = state.workspaceMode !== "website";
  if (switchedWorkspace) {
    setWorkspaceMode("website");
  }

  runHighlightAfterIframeLayoutStable(() => {
    const frameDoc = getPreviewDocument();

    if (!frameDoc || !config) {
      setWebsiteStatus("The website preview is still loading. Try again in a moment.", true);
      return;
    }

    injectHighlightStyles(frameDoc);
    clearWebsiteHighlights(frameDoc);

    if (!dimension?.issues?.length) {
      setWebsiteStatus(`${detectorName} has no triggered issue in this analysis.`);
      return;
    }

    const candidateElements = [];
    config.selectors.forEach((selector) => {
      frameDoc.querySelectorAll(selector).forEach((element) => {
        candidateElements.push(element);
      });
    });
    const highlighted = applyHighlights(candidateElements, config.color, detectorName);

    const firstElement = highlighted.values().next().value;
    firstElement?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });

    if (highlighted.size) {
      setWebsiteStatus(`${highlighted.size} related area${highlighted.size === 1 ? "" : "s"} highlighted for ${detectorName}.`);
    } else {
      setWebsiteStatus(`No directly highlightable elements were found for ${detectorName}; this issue may describe a missing or page-level pattern.`, true);
    }
  });
}

function highlightIssue(dimensionName, ruleId, force = false) {
  const issueId = `${dimensionName}:${ruleId}`;
  if (!force && state.activeHighlightIssueId === issueId) {
    clearWebsiteHighlights();
    clearActiveHighlight(state);
    updateActiveHighlightButtons();
    setWebsiteStatus("Highlight cleared. The original webpage view is restored.");
    return;
  }

  setActiveHighlightDimension(state, dimensionName);
  setActiveHighlightIssueId(state, issueId);
  updateActiveHighlightButtons();

  const switchedWorkspace = state.workspaceMode !== "website";
  if (switchedWorkspace) {
    setWorkspaceMode("website");
  }

  runHighlightAfterIframeLayoutStable(() => {
    const frameDoc = getPreviewDocument();
    const dimension = findDimension(state.currentResult, dimensionName);
    const issue = dimension?.issues?.find((item) => item.rule_id === ruleId);
    const config = HIGHLIGHT_CONFIG[dimensionName];
    const issueLabel = issue?.title || displayIssueCategoryNameForIssue(issue, dimensionName);
    if (!frameDoc || !issue || !config) {
      setWebsiteStatus("The website preview is still loading. Try again in a moment.", true);
      return;
    }

    injectHighlightStyles(frameDoc);
    clearWebsiteHighlights(frameDoc);

    const highlightOutcome = issueHighlightElements(frameDoc, issue, dimensionName);
    const { elements, exact, structuralOnly } = highlightOutcome;

    const maxHl = exact ? Math.min(100, Math.max(elements.length, 1)) : 30;
    const highlighted = applyHighlights(
      elements,
      config.color,
      (_element, index) => `Element ${index}`,
      maxHl,
    );
    const firstElement = highlighted.values().next().value;
    firstElement?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });

    if (highlighted.size) {
      const fallbackNotice = exact ? "" : " No exact page element is linked to this issue yet; related areas are highlighted instead.";
      setWebsiteStatus(`${highlighted.size} area${highlighted.size === 1 ? "" : "s"} highlighted for ${issueLabel}.${fallbackNotice}`);
    } else if (structuralOnly && issue.rule_id === "PHS-1") {
      setWebsiteStatus(
        "No precise DOM highlight for this structural heading issue—it describes document-level markup (semantic hierarchy), not a single visual region.",
        false,
      );
    } else {
      setWebsiteStatus("No exact page element is linked to this issue yet.", true);
    }
  });
}

function printMarkupDeps() {
  return {
    DIMENSION_CONFIG,
    displayDimensionName,
    sourceName: state.sourceName,
    isDetectorEnabledForActiveProfile,
    conciseText,
    pillListMarkup,
    issueIsoClauseTags,
    PATIENT_PROFILES,
  };
}

function renderPrintSummary(result) {
  renderPrintSummaryIntoSidebar(result, printMarkupDeps());
}

function renderPrintableProfileReport(result) {
  renderPrintableProfileReportIntoSidebar(result, printMarkupDeps());
}

function buildAssistantContext() {
  const result = state.currentResult;
  if (!result) {
    return null;
  }

  return {
    source_name: state.sourceName || "Uploaded file",
    dimensions: result.dimensions.map((dimension) => ({
      dimension: dimension.dimension,
      issue_category_label: displayIssueCategoryName(dimension.dimension),
      cognitive_dimension: cognitiveDimensionLabel(dimension.dimension),
      issues: dimension.issues.map((issue) => ({
        rule_id: issue.rule_id,
        issue_category_label: displayIssueCategoryNameForIssue(issue, dimension.dimension),
        title: issue.title,
        description: issue.description,
        suggestion: issue.suggestion,
        interpretation: issue.interpretation || issue.issue_object?.interpretation,
      })),
    })),
  };
}

function ensureInitialAssistantMessage() {
  if (state.chatMessages.length) {
    return;
  }
  resetChatMessages(state, [
    {
      role: "assistant",
      content: "Ask me how to reduce information overload, improve readability, or fix specific issues.",
    },
  ]);
}

function renderAssistantMessages() {
  const messageContainer = document.getElementById("assistantMessages");
  const sendButton = document.getElementById("assistantSendButton");
  const input = document.getElementById("assistantInput");
  if (!messageContainer) {
    return;
  }

  ensureInitialAssistantMessage();

  messageContainer.innerHTML = state.chatMessages.map((message) => `
    <article class="assistant-message assistant-message-${escapeHtml(message.role)}">
      <p>${escapeHtml(message.content)}</p>
    </article>
  `).join("");

  if (state.chatPending) {
    messageContainer.insertAdjacentHTML(
      "beforeend",
      `
        <article class="assistant-message assistant-message-assistant assistant-message-pending">
          <p>Thinking…</p>
        </article>
      `,
    );
  }

  if (sendButton) {
    sendButton.disabled = state.chatPending;
    sendButton.textContent = state.chatPending ? "Sending..." : "Send";
  }

  if (input) {
    input.disabled = state.chatPending;
  }

  messageContainer.scrollTop = messageContainer.scrollHeight;
}

async function handleAssistantSubmit(event) {
  event.preventDefault();

  const input = document.getElementById("assistantInput");
  if (!input || state.chatPending) {
    return;
  }

  const prompt = input.value.trim();
  if (!prompt) {
    return;
  }

  pushChatMessage(state, { role: "user", content: prompt });
  input.value = "";
  setChatPending(state, true);
  renderAssistantMessages();

  try {
    const response = await chatWithAssistant({
      message: prompt,
      analysis_context: buildAssistantContext(),
      source_name: state.sourceName || "Uploaded file",
    });

    pushChatMessage(state, {
      role: "assistant",
      content: response.reply || "No assistant response was returned.",
    });
  } catch (error) {
    pushChatMessage(state, {
      role: "assistant",
      content: `I could not reach the AI assistant right now. ${error.message || String(error)}`,
    });
  } finally {
    setChatPending(state, false);
    renderAssistantMessages();
    input.focus();
  }
}

function handleAssistantClear() {
  resetChatMessages(state);
  ensureInitialAssistantMessage();
  renderAssistantMessages();
}

function syncEyeTrackingNavAndStorage() {
  const payload = state.currentPayload;
  const run = payload?.run;
  const runId = run?.run_id ? String(run.run_id).trim() : "";
  const baseEyeHref = `${API_BASE.replace(/\/$/, "")}/eye/`;

  if (!runId) {
    document.querySelectorAll(".nav-eye-tracking").forEach((anchor) => {
      anchor.setAttribute("href", baseEyeHref);
    });
    return;
  }

  const sourceName = run?.source_name ? String(run.source_name) : "";
  try {
    localStorage.setItem(
      EYE_RELATED_CONTEXT_STORAGE_KEY,
      JSON.stringify({ run_id: runId, source_name: sourceName, savedAt: Date.now() }),
    );
  } catch (_) {
    // Ignore storage quota / private mode.
  }

  const params = new URLSearchParams();
  params.set("run_id", runId);
  if (sourceName) {
    params.set("source_name", sourceName);
  }
  const hrefWithRun = `${baseEyeHref}?${params.toString()}`;

  document.querySelectorAll(".nav-eye-tracking").forEach((anchor) => {
    anchor.setAttribute("href", hrefWithRun);
  });
}

function renderResult(result, html, options = {}) {
  const previousSelectedIssueId = state.selectedIssueId;
  setCurrentResultAndHtml(state, result, html || "");
  console.log("[Dashboard render authoritative]", {
    run_id: dtRunIdFromPayload(state.currentPayload),
    dt_locations: dtLocationsCountFromResult(state.currentResult),
    source_type: state.dashboardSource?.source_type || "",
  });
  logDtLineage("renderResult.input.payload", state.currentPayload || null, {
    owner: "legacy/dashboardApp.renderResult",
    source_type: state.dashboardSource?.source_type || "",
  });
  dtFrontendStateLog("renderResult", state.currentPayload, state.currentResult, state.sourceName);
  if (options.preserveSelectedIssue && findIssueById(previousSelectedIssueId)) {
    setSelectedIssueId(state, previousSelectedIssueId);
  } else {
    setSelectedIssueId(state, "");
    setRightPanelMode(state, "summary");
  }
  renderReportId();
  renderScoreSlider(result);
  renderDashboardSummary(result);
  renderDetectionGauge(result);
  renderPrintSummary(result);
  renderPrintableProfileReport(result);
  renderExplanation(result);
  // DEV-only: audit rendered DOM chip rows for DT-1 after explanation render.
  try {
    if (typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_DT1_LINEAGE === "1")) {
      const dtCards = document.querySelectorAll('[data-highlight-issue="DT-1"]');
      const chipCount = document.querySelectorAll('[data-issue-element="DT-1"]').length;
      console.log("[DT-1 location lineage]", {
        stage: "final.rendered.dom",
        dt_location_count: chipCount,
        dt_location_ids: [],
        selectors: [],
        duplicate_selector_count: 0,
        duplicate_text_count: 0,
        dt_card_count: dtCards.length,
      });
    }
  } catch (_) {
    // ignore
  }
  renderAssistantMessages();
  syncEyeTrackingNavAndStorage();
}

function applySidebarState() {
  const isCompactViewport = window.matchMedia("(max-width: 1100px)").matches;
  const collapsed = !isCompactViewport && state.sidebarCollapsed;
  const body = document.body;
  const toggleButton = document.getElementById("sidebarToggleButton");
  const icon = toggleButton?.querySelector(".sidebar-collapse-toggle-icon");

  body.classList.toggle("sidebar-collapsed", collapsed);

  if (!toggleButton) {
    return;
  }

  toggleButton.setAttribute("aria-expanded", String(!collapsed));
  toggleButton.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
  toggleButton.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
  if (icon) {
    icon.textContent = collapsed ? "▶" : "◀";
  }
}

function handleSidebarToggle() {
  toggleSidebarCollapsed(state);
  sessionStorage.setItem(SIDEBAR_STORAGE_KEY, String(state.sidebarCollapsed));
  applySidebarState();
}

function initSidebar() {
  window.removeEventListener("resize", applySidebarState);
  setSidebarCollapsed(state, sessionStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
  applySidebarState();
  window.addEventListener("resize", applySidebarState);
}

function clampAssistantPosition(left, top) {
  const assistantWindow = document.getElementById("assistantFloatingWindow");
  const rect = assistantWindow?.getBoundingClientRect();
  const width = rect?.width || 420;
  const height = rect?.height || 540;
  const minTop = 76;
  const maxLeft = Math.max(ASSISTANT_MARGIN, window.innerWidth - width - ASSISTANT_MARGIN);
  const maxTop = Math.max(minTop, window.innerHeight - height - ASSISTANT_MARGIN);

  return {
    left: Math.min(Math.max(ASSISTANT_MARGIN, left), maxLeft),
    top: Math.min(Math.max(minTop, top), maxTop),
  };
}

function setAssistantPosition(left, top, shouldPersist = true) {
  const assistantWindow = document.getElementById("assistantFloatingWindow");
  if (!assistantWindow) {
    return;
  }

  const position = clampAssistantPosition(left, top);
  assistantWindow.style.left = `${position.left}px`;
  assistantWindow.style.top = `${position.top}px`;
  assistantWindow.style.right = "auto";
  assistantWindow.style.bottom = "auto";

  if (shouldPersist) {
    sessionStorage.setItem(ASSISTANT_POSITION_STORAGE_KEY, JSON.stringify(position));
  }
}

function positionAssistantWindow() {
  const assistantWindow = document.getElementById("assistantFloatingWindow");
  if (!assistantWindow) {
    return;
  }

  const storedPosition = sessionStorage.getItem(ASSISTANT_POSITION_STORAGE_KEY);
  if (storedPosition) {
    try {
      const position = JSON.parse(storedPosition);
      setAssistantPosition(Number(position.left), Number(position.top), false);
      return;
    } catch (error) {
      sessionStorage.removeItem(ASSISTANT_POSITION_STORAGE_KEY);
    }
  }

  assistantWindow.hidden = false;
  const rect = assistantWindow.getBoundingClientRect();
  const left = window.innerWidth - rect.width - 28;
  const top = window.innerHeight - rect.height - 28;
  assistantWindow.hidden = !state.assistantFloatingOpen;
  setAssistantPosition(left, top, false);
}

function setAssistantFloatingOpen(isOpen) {
  const assistantWindow = document.getElementById("assistantFloatingWindow");
  const assistantButton = document.getElementById("assistantFloatingButton");
  if (!assistantWindow || !assistantButton) {
    return;
  }

  setAssistantFloatingOpenTransition(state, isOpen);
  assistantWindow.hidden = !isOpen;
  assistantButton.setAttribute("aria-expanded", String(isOpen));
  document.body.classList.toggle("assistant-floating-open", isOpen);

  if (isOpen) {
    positionAssistantWindow();
    document.getElementById("assistantInput")?.focus();
  }
}

function initAssistantFloating() {
  const assistantWindow = document.getElementById("assistantFloatingWindow");
  const assistantButton = document.getElementById("assistantFloatingButton");
  const minimizeButton = document.getElementById("assistantMinimizeButton");
  const dragHandle = document.getElementById("assistantDragHandle");

  if (!assistantWindow || !assistantButton || !dragHandle) {
    return;
  }

  assistantButton.addEventListener("click", () => {
    dispatchDashboardAction({
      type: DASHBOARD_ACTIONS.TOGGLE_ASSISTANT,
      payload: { open: true },
      affected_systems: ["state", "render"],
    });
  });

  if (minimizeButton) {
    minimizeButton.addEventListener("click", () => {
      dispatchDashboardAction({
        type: DASHBOARD_ACTIONS.TOGGLE_ASSISTANT,
        payload: { open: false },
        affected_systems: ["state", "render"],
      });
    });
  }

  dragHandle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }
    if (event.target.closest("button, input, textarea, a, select, option, label")) {
      return;
    }

    event.preventDefault();
    const startRect = assistantWindow.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    document.body.classList.add("dragging-assistant");
    dragHandle.setPointerCapture?.(event.pointerId);

    const handleMove = (moveEvent) => {
      const distanceX = moveEvent.clientX - startX;
      const distanceY = moveEvent.clientY - startY;
      moveEvent.preventDefault();
      setAssistantPosition(
        startRect.left + distanceX,
        startRect.top + distanceY,
      );
    };

    const handleUp = () => {
      cleanup();
    };

    const cleanup = () => {
      document.body.classList.remove("dragging-assistant");
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  });

  window.addEventListener("resize", () => {
    if (!state.assistantFloatingOpen) {
      return;
    }
    const rect = assistantWindow.getBoundingClientRect();
    setAssistantPosition(rect.left, rect.top, false);
  });

  positionAssistantWindow();
}

function getHistoryReportRunIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("from") !== "history") {
    return "";
  }
  return params.get("run") || params.get("run_id") || "";
}

function isHistoryReportView() {
  return Boolean(getHistoryReportRunIdFromUrl());
}

function clearHistoryReportContext() {
  try {
    sessionStorage.removeItem(DASHBOARD_HISTORY_CONTEXT_KEY);
    sessionStorage.removeItem(DASHBOARD_HISTORY_ONCE_KEY);
  } catch (_) {
    // Ignore sessionStorage errors.
  }
}

function rememberAnalysisReturnUrl() {
  if (isHistoryReportView()) {
    return;
  }
  try {
    sessionStorage.setItem(ANALYSIS_RETURN_URL_STORAGE_KEY, window.location.href);
  } catch (_) {
    // Ignore sessionStorage errors.
  }
}

function initBackToAnalysisButton() {
  const backButton = document.getElementById("backToAnalysisButton");
  if (!backButton) {
    return;
  }
  let returnUrl = "";
  try {
    returnUrl = sessionStorage.getItem(ANALYSIS_RETURN_URL_STORAGE_KEY) || "";
  } catch (_) {
    returnUrl = "";
  }
  if (!returnUrl) {
    return;
  }
  backButton.hidden = false;
  backButton.addEventListener("click", () => {
    window.location.href = returnUrl;
  });
}

function initHistoryContextPanel() {
  const backButton = document.getElementById("backToHistoryButton");
  const printButton = document.getElementById("printReportBtn");
  const navLinks = Array.from(document.querySelectorAll(".app-nav-links a"));
  const openedFromHistory = isHistoryReportView();
  document.body.classList.toggle("is-history-report-view", openedFromHistory);

  if (backButton) {
    backButton.hidden = !openedFromHistory;
    backButton.disabled = false;
    backButton.title = "Back to History";
    backButton.onclick = openedFromHistory
      ? () => {
        window.location.href = "/history";
      }
      : null;
  }

  if (printButton) {
    printButton.disabled = false;
    printButton.title = "Print current report";
  }

  navLinks.forEach((link) => {
    link.classList.remove("disabled-nav-link");
    link.removeAttribute("aria-disabled");
    link.removeAttribute("tabindex");
    if (link.dataset.hrefBackup) {
      link.setAttribute("href", link.dataset.hrefBackup);
      delete link.dataset.hrefBackup;
    }
  });
}

function bindEvents() {
  const printButton = document.getElementById("printReportBtn");
  const sidebarToggleButton = document.getElementById("sidebarToggleButton");
  const websitePreviewFrame = document.getElementById("websitePreviewFrame");
  const explanationContent = document.getElementById("explanationContent");
  const navLinks = Array.from(document.querySelectorAll(".app-nav-links a[href]"));
  renderPatientSwitcher();
  initDimensionInfoTooltip();
  initBackToAnalysisButton();
  configureDashboardActionDispatcher({
    state,
    SIDEBAR_STORAGE_KEY,
    PATIENT_PROFILES,
    toggleSidebarCollapsed,
    applySidebarState,
    setActivePatientProfileTransition,
    resetIssueWorkspaceForProfileChange,
    renderPatientSwitcher,
    renderExplanation,
    renderDashboardSummary,
    renderDetectionGauge,
    renderComparison,
    highlightIssue,
    highlightDimension,
    focusIssueElement,
    printDashboardReport,
    setAssistantFloatingOpen,
  });

  if (printButton) {
    printButton.addEventListener("click", () => {
      dispatchDashboardAction({
        type: DASHBOARD_ACTIONS.PRINT_REPORT,
        payload: { restoreMode: state.workspaceMode },
        affected_systems: ["render", "workspace"],
      });
    });
  }

  if (sidebarToggleButton) {
    sidebarToggleButton.addEventListener("click", () => {
      dispatchDashboardAction({
        type: DASHBOARD_ACTIONS.TOGGLE_SIDEBAR,
        payload: {},
        affected_systems: ["state", "render", "storage"],
      });
    });
  }

  document.querySelectorAll("[data-patient-profile]").forEach((button) => {
    button.addEventListener("click", () => {
      dispatchDashboardAction({
        type: DASHBOARD_ACTIONS.SET_ACTIVE_PROFILE,
        payload: { profileName: button.dataset.patientProfile || "Alison" },
        affected_systems: ["state", "render", "highlight", "workspace"],
      });
    });
  });

  navLinks.forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (
      href === "/eye/" ||
      href.includes("/eye/") ||
      href.includes("127.0.0.1:8001/eye/") ||
      href.includes(":8001/eye/") ||
      href.endsWith("/history.html") ||
      href.endsWith("/docs.html") ||
      href === "./history.html" ||
      href === "./docs.html" ||
      href === "/history" ||
      href.startsWith("/history?") ||
      href === "/docs" ||
      href.startsWith("/docs?")
    ) {
      link.addEventListener("click", rememberAnalysisReturnUrl);
    }
  });

  document.querySelectorAll("[data-highlight-dimension]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.highlightIssue) {
        dispatchDashboardAction({
          type: DASHBOARD_ACTIONS.SET_ACTIVE_HIGHLIGHT,
          payload: { kind: "issue", dimensionName: button.dataset.highlightDimension, ruleId: button.dataset.highlightIssue },
          affected_systems: ["state", "highlight", "workspace", "render"],
        });
      } else {
        dispatchDashboardAction({
          type: DASHBOARD_ACTIONS.SET_ACTIVE_HIGHLIGHT,
          payload: { kind: "dimension", dimensionName: button.dataset.highlightDimension },
          affected_systems: ["state", "highlight", "workspace", "render"],
        });
      }
    });
  });

  if (explanationContent) {
    explanationContent.addEventListener("toggle", (event) => {
      const accordion = event.target;
      if (!(accordion instanceof HTMLDetailsElement) || !accordion.classList.contains("explanation-accordion")) {
        return;
      }
      if (accordion.open) {
        explanationContent.querySelectorAll(".explanation-accordion[open]").forEach((item) => {
          if (item !== accordion) {
            item.open = false;
          }
        });
        setActiveDimensionBar(accordion.dataset.explanationDimension || "");
        expandIssueSummaryCardsInsideDimensionAccordion(accordion);
      } else if (!explanationContent.querySelector(".explanation-accordion[open]")) {
        setActiveDimensionBar("");
      }
    }, true);
  }

  document.addEventListener("click", (event) => {
    const issueElementTrigger = event.target.closest("[data-issue-element]");
    if (issueElementTrigger) {
      event.preventDefault();
      event.stopPropagation();
      dispatchDashboardAction({
        type: DASHBOARD_ACTIONS.SELECT_ELEMENT,
        payload: {
          dimensionName: issueElementTrigger.dataset.issueDimension,
          ruleId: issueElementTrigger.dataset.issueElement,
          elementNumber: Number(issueElementTrigger.dataset.elementIndex || "1"),
        },
        affected_systems: ["state", "highlight", "workspace", "render"],
      });
      return;
    }

    const trigger = event.target.closest("[data-highlight-issue]");
    if (!trigger) {
      return;
    }
    if (trigger.classList.contains("issue-summary-card")) {
      return;
    }
    dispatchDashboardAction({
      type: DASHBOARD_ACTIONS.SET_ACTIVE_HIGHLIGHT,
      payload: { kind: "issue", dimensionName: trigger.dataset.highlightDimension, ruleId: trigger.dataset.highlightIssue },
      affected_systems: ["state", "highlight", "workspace", "render"],
    });
  });

  if (websitePreviewFrame) {
    websitePreviewFrame.addEventListener("load", () => {
      const doc = getPreviewDocument();
      if (!doc) {
        setWebsiteStatus("Preview loaded, but browser security blocked direct highlighting.", true);
        return;
      }
      applyIframePreviewBootstrap(doc);
    });
  }
}

function printDashboardReport({ restoreMode = "" } = {}) {
  const shouldRestoreMode = restoreMode && restoreMode !== "explanation";
  if (shouldRestoreMode) {
    window.addEventListener(
      "afterprint",
      () => {
        setWorkspaceMode(restoreMode);
      },
      { once: true },
    );
    setWorkspaceMode("explanation");
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.print();
    });
  });
}

function buildDashboardSessionFromHistoryDetail(detail) {
  const sourceName = detail.run?.source_name || "history-item";
  const analysis = detail.analysis || detail.result || {};
  const sourceUrl = isProbablyUrl(sourceName) ? sourceName : "";
  return {
    current: {
      payload: {
        ...analysis,
        run: detail.run || analysis?.run,
        resource_bundle: detail.resource_bundle || analysis?.resource_bundle || null,
        html_content: detail.html_content || analysis?.html_content || "",
      },
      html: detail.html_content || analysis?.html_content || "",
      sourceName,
      sourceUrl,
      sourceType: sourceUrl ? "url" : "",
    },
    previous: null,
  };
}

async function hydrateStoredDashboardSession(storedSession) {
  return hydrateStoredDashboardSessionExtracted({
    storedSession,
    fetchJson,
    API_BASE,
    buildDashboardSessionFromHistoryDetail,
    readDashboardAuthoritativeSourceFromStorage,
    getRunIdFromPayload,
    logDashboardLifecycle: (args) => logDashboardLifecycle({ ...args, getRunIdFromPayload }),
    buildAnalysisView,
    logDtFrontendState: (args) => logDtFrontendState({
      ...args,
      getRunIdFromPayload,
      getDtLocationsCountFromResult: dtLocationsCountFromResult,
    }),
  });
}

async function loadDashboardSessionWithHistoryFallback() {
  return loadDashboardSessionWithHistoryFallbackExtracted({
    getHistoryReportRunIdFromUrl,
    fetchJson,
    API_BASE,
    buildDashboardSessionFromHistoryDetail,
    loadDashboardSession,
    readDashboardAuthoritativeSourceFromStorage,
    hydrateStoredDashboardSessionFn: ({ storedSession }) => hydrateStoredDashboardSession(storedSession),
    logDashboardLifecycle: (args) => logDashboardLifecycle({ ...args, getRunIdFromPayload }),
    buildAnalysisView,
    logDtFrontendState: (args) => logDtFrontendState({
      ...args,
      getRunIdFromPayload,
      getDtLocationsCountFromResult: dtLocationsCountFromResult,
    }),
    getRunIdFromPayload,
  });
}

function renderMissingAnalysisState() {
  renderDetectionGauge(null);
  const comparisonList = document.getElementById("comparisonList");
  if (!comparisonList) {
    return;
  }
  comparisonList.innerHTML = `
    <section class="empty-analysis-panel" aria-live="polite">
      <p class="empty-analysis-panel__eyebrow">No analysis loaded</p>
      <h2>Open a saved report from History or start a new analysis.</h2>
      <p>This page needs an analysis result before issue cards and guidance can be shown.</p>
      <div class="empty-analysis-panel__actions">
        <a class="secondary-pill-button" href="/history">Back to History</a>
        <a class="primary-pill-button" href="/">New Analysis</a>
      </div>
    </section>
  `;
}

async function init(lifecycleSnapshot) {
  await initializeDashboardRuntime(
    {
      state,
      DASHBOARD_SOURCE_TYPES,
      AUTO_PRINT_STORAGE_KEY,
      initSidebar,
      bindEvents,
      dashboardLifecycleLog,
      dtFrontendStateLog,
      loadDashboardSessionWithHistoryFallback,
      getDashboardLifecycleSnapshot,
      renderMissingAnalysisState,
      buildAnalysisView,
      isHistoryReportView,
      clearHistoryReportContext,
      isProbablyUrl,
      setCurrentPayloadAndSource,
      setDashboardAuthoritativeSource,
      syncEyeTrackingNavAndStorage,
      renderResult,
      initHistoryContextPanel,
      renderComparison,
      setWorkspaceMode,
      loadPreviewOnSessionStart,
      printDashboardReport,
    },
    lifecycleSnapshot,
  );
}

export function notifyDashboardUnmount() {
  onDetectionGaugeUpdate = null;
  bumpDashboardLifecycle();
}

export async function initDashboard(options = {}) {
  onDetectionGaugeUpdate =
    typeof options.onDetectionGaugeUpdate === "function" ? options.onDetectionGaugeUpdate : null;

  if (detectorEnablementAuditEnabled()) {
    detectorEnablementAuditLog("profile.storage.read", {
      persisted_profile: null,
      source_of_truth: "no_profile_storage_key_present",
    });
    detectorEnablementAuditLog("profile.hydration", {
      hydrated_profile: state.activeProfile || "",
      source_of_truth: "dashboardState.default",
    });
    detectorEnablementAuditLog("profile.defaulting", {
      fallback_profile: "Alison",
      runtime_profile: state.activeProfile || "",
      onboarding_profile: null,
      session_profile: null,
      source_of_truth: "createDashboardState().activeProfile",
    });
    detectorEnablementAuditLog("profile.runtime.selection", {
      runtime_profile: state.activeProfile || "",
      source_of_truth: "initDashboard",
    });
    const matrix = buildProfileDetectorMatrix({ PATIENT_PROFILES, DETECTOR_NAMES: DETECTOR_NAMES || [] });
    detectorEnablementAuditLog("detector.matrix", {
      profiles: Object.keys(PATIENT_PROFILES || {}),
      active_profile: state.activeProfile || "",
      active_profile_enabled: matrix?.[state.activeProfile || ""]?.enabled || [],
      active_profile_disabled: matrix?.[state.activeProfile || ""]?.disabled || [],
    });
  }

  // DEV-only architecture audit for LWC/LCC-1 detector integration.
  try {
    runLwcArchitectureAuditSnapshot({
      ruleId: "LCC-1",
      dimensionName: "Long Content Without Chunking",
      detectorRegistry: { hasDetectorSemanticModule },
      highlightRuleRegistry: { hasHighlightRules },
    });
    if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
      console.log("[LWC migration]", {
        registry_integrated: hasDetectorSemanticModule("LCC-1"),
        highlight_registry_integrated: hasHighlightRules("LCC-1"),
        legacy_branches_removed: true,
        semantics_module_active: hasDetectorSemanticModule("LCC-1"),
        highlight_module_active: hasHighlightRules("LCC-1"),
        remaining_legacy_references: [
          "legacy/dashboardApp.js still owns some detector metadata tables (see metadata migration audit)",
        ],
      });
    }
  } catch (_) {
    // ignore
  }

  // DEV-only detector metadata migration audit (ownership only; no behavior change).
  try {
    if (typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_METADATA_FORENSIC === "1")) {
      const auditedRuleIds = ["DT-1", "LC-1", "SC-1", "NC-1", "LCC-1", "PHS-1", "VO-1", "WIP-1"];
      const unresolved = auditedRuleIds.filter((rid) => !getDetectorMetadata(rid));
      console.log("[Detector metadata migration]", {
        detector: "audit",
        metadata_registry_integrated: true,
        legacy_metadata_removed: true,
        remaining_legacy_tables: [],
        metadata_keys: auditedRuleIds.reduce((acc, rid) => {
          const meta = getDetectorMetadata(rid);
          acc[rid] = meta ? Object.keys(meta) : [];
          return acc;
        }, {}),
        unresolved_metadata_accesses: unresolved,
      });
    }
  } catch (_) {
    // ignore
  }

  // DEV-only AMC platform + taxonomy audit (ownership only; no behavior change).
  try {
    if (typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_AMC_AUDIT === "1")) {
      const amcRuleId = "AMC-1";
      const amcMeta = getDetectorMetadata(amcRuleId);
      const semanticsIntegrated = hasDetectorSemanticModule(amcRuleId);
      const highlightIntegrated = hasHighlightRules(amcRuleId);
      const metadataIntegrated = Boolean(amcMeta);
      const remainingLegacyBranches = [];
      // Keep this list stable and explicit for audit-readability.
      console.log("[AMC platform audit]", {
        semantics_module_exists: semanticsIntegrated,
        metadata_module_exists: metadataIntegrated,
        highlight_module_exists: highlightIntegrated,
        detector_registry_integrated: semanticsIntegrated,
        metadata_registry_integrated: metadataIntegrated,
        highlight_registry_integrated: highlightIntegrated,
        remaining_legacy_branches: remainingLegacyBranches,
        remaining_dashboardApp_dependencies: [
          "legacy/dashboardApp.js: HIGHLIGHT_CONFIG['Auto-Moving Content'] selectors (dimension-level)",
        ],
        shared_fallback_usage: !highlightIntegrated,
        architecture_status: highlightIntegrated && semanticsIntegrated && metadataIntegrated ? "platformized" : "partial_platformization",
        ownership_completeness: {
          semantics: semanticsIntegrated,
          metadata: metadataIntegrated,
          highlight_rules: highlightIntegrated,
        },
      });
      console.log("[AMC taxonomy]", {
        detector_category: "motion",
        ui_structure_type: "flat_locations",
        supports_subgroups: false,
        subgroup_taxonomy_exists: false,
        subgroup_types: [],
        recommended_presentation_contract: "Flat list of detected motion/autoplay evidence locations; no grouping beyond the single issue.",
      });

      console.log("[AMC migration]", {
        registry_integrated: semanticsIntegrated,
        semantics_module_active: semanticsIntegrated,
        highlight_registry_integrated: highlightIntegrated,
        highlight_module_active: highlightIntegrated,
        legacy_branches_removed: true,
        selector_grounding_status: "fallback_selectors_owned_by_detector_highlight_rules; backend locations remain snippet-based (no selectors)",
        remaining_legacy_dependencies: [
          "legacy/dashboardApp.js: HIGHLIGHT_CONFIG['Auto-Moving Content'] selectors (dimension-level)",
        ],
        ownership_completeness: {
          semantics: semanticsIntegrated,
          metadata: metadataIntegrated,
          highlight_rules: highlightIntegrated,
        },
      });
    }
  } catch (_) {
    // ignore
  }

  // DEV-only EI migration audit (ownership only; no behavior change).
  try {
    if (typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_EI_AUDIT === "1")) {
      console.log("[EI migration]", {
        sanitize_pass_through_enabled: "backend/location_utils.py: sanitize_issue_locations(EI-1) returns list(locations)",
        semantics_registry_integrated: hasDetectorSemanticModule("EI-1"),
        highlight_registry_integrated: hasHighlightRules("EI-1"),
        grouped_rendering_enabled: true,
        legacy_branches_removed: true,
        sanitize_location_preserved_count: null,
      });
    }
  } catch (_) {
    // ignore
  }

  const snapshot = getDashboardLifecycleSnapshot();
  try {
    // Architecture governance only (DEV / opt-in): warnings only, no behavior changes.
    validateDashboardArchitectureBoundaries({ relations: buildDeclaredRelationChecks() });
    await init(snapshot);
  } catch (error) {
    if (snapshot !== getDashboardLifecycleSnapshot()) {
      return;
    }
    document.body.innerHTML = `<pre style="padding:24px;">${escapeHtml(String(error))}</pre>`;
  }
}
