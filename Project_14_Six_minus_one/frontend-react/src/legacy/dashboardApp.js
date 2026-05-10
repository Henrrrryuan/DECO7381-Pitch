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
  renderPrintSummary as renderPrintSummaryIntoSidebar,
  renderPrintableProfileReport as renderPrintableProfileReportIntoSidebar,
} from "../lib/printAndDownload.js";

const state = {
  currentHtml: "",
  currentResult: null,
  currentPayload: null,
  sourceName: "",
  sourceUrl: "",
  /** `"url"` | `"zip"` | `"html"` | "" — from dashboard session (LoadingPage / HomePage). */
  sourceType: "",
  workspaceMode: "explanation",
  rightPanelMode: "summary",
  activeHighlightDimension: "",
  activeHighlightIssueId: "",
  selectedIssueId: "",
  selectedElementNumber: 0,
  activeGuidancePopoverKey: "",
  /** When true, preview guidance stays visible after pointer leaves (until close or second click). */
  previewGuidancePinned: false,
  chatMessages: [],
  chatPending: false,
  sidebarCollapsed: false,
  assistantFloatingOpen: false,
  previousResult: null,
  previousSourceName: "",
  activeProfile: "Alison",
};

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

const PATIENT_PROFILES = {
  Alison: {
    label: "Mild Cognitive Impairment",
    condition: "Mild Cognitive Impairment",
    summary: "Needs familiar controls, clear navigation, low clutter, and forgiving task flow.",
    enabledDetectors: [
      "Weak Information Prominence",
      "Poor Heading Structure",
      "Navigation Complexity",
      "Visual Overload",
      "Long Content Without Chunking",
      "Auto-Moving Content",
      "Excessive Interruptions",
    ],
    detectorOrder: [
      "Weak Information Prominence",
      "Poor Heading Structure",
      "Navigation Complexity",
      "Visual Overload",
      "Long Content Without Chunking",
      "Auto-Moving Content",
      "Excessive Interruptions",
    ],
  },
  Amy: {
    label: "Autism-related Needs",
    condition: "Autism-related Needs",
    summary: "Needs literal language, consistent structure, low clutter, and reduced sensory distraction.",
    enabledDetectors: [
      "Poor Heading Structure",
      "Navigation Complexity",
      "Weak Information Prominence",
      "Visual Overload",
      "Auto-Moving Content",
      "Excessive Interruptions",
      "Long Content Without Chunking",
      "Language Complexity",
    ],
    detectorOrder: [
      "Poor Heading Structure",
      "Navigation Complexity",
      "Weak Information Prominence",
      "Visual Overload",
      "Auto-Moving Content",
      "Excessive Interruptions",
      "Long Content Without Chunking",
      "Language Complexity",
    ],
  },
  Tal: {
    label: "Dyslexia & Motor Support",
    condition: "Dyslexia & Motor Support",
    summary: "Needs readable structure, stronger headings, clearer recovery, and easier interaction targets.",
    enabledDetectors: [
      "Dense Text Detection",
      "Sentence Complexity",
      "Language Complexity",
      "Long Content Without Chunking",
      "Poor Heading Structure",
      "Weak Information Prominence",
      "Navigation Complexity",
      "Visual Overload",
      "Auto-Moving Content",
      "Excessive Interruptions",
    ],
    detectorOrder: [
      "Dense Text Detection",
      "Sentence Complexity",
      "Language Complexity",
      "Long Content Without Chunking",
      "Poor Heading Structure",
      "Weak Information Prominence",
      "Navigation Complexity",
      "Visual Overload",
      "Auto-Moving Content",
      "Excessive Interruptions",
    ],
  },
  Yuki: {
    label: "ADHD-friendly Focus",
    condition: "ADHD-friendly Focus",
    summary: "Needs reduced distraction, clear chunking, stronger focus guidance, and calmer task flow.",
    enabledDetectors: [
      "Auto-Moving Content",
      "Excessive Interruptions",
      "Visual Overload",
      "Weak Information Prominence",
      "Long Content Without Chunking",
      "Dense Text Detection",
      "Poor Heading Structure",
      "Navigation Complexity",
      "Sentence Complexity",
      "Language Complexity",
    ],
    detectorOrder: [
      "Auto-Moving Content",
      "Excessive Interruptions",
      "Visual Overload",
      "Weak Information Prominence",
      "Long Content Without Chunking",
      "Poor Heading Structure",
      "Dense Text Detection",
      "Navigation Complexity",
      "Sentence Complexity",
      "Language Complexity",
    ],
  },
};
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

const RULE_FRAMEWORK_MAP = {
  "DT-1": {
    coga: "COGA: Break content into manageable chunks",
    iso: "ISO 9241-11:2018 6.3.2 Time used; 6.3.3 Human effort expended",
    wcag: "WCAG SC 1.3.1 Info and Relationships; SC 2.4.6 Headings and Labels",
  },
  "LC-1": {
    coga: "COGA: Prefer familiar vocabulary",
    iso: "ISO 9241-11:2018 6.2.2 Accuracy; 6.4.3 Cognitive responses",
    wcag: "WCAG SC 3.1.3 Unusual Words; SC 3.1.5 Reading Level (AAA)",
  },
  "SC-1": {
    coga: "COGA: Use shorter, easier language",
    iso: "ISO 9241-11:2018 6.2.2 Accuracy",
    wcag: "WCAG SC 3.1.5 Reading Level (AAA)",
  },
  "LCC-1": {
    coga: "COGA: Support scanning with chunking",
    iso: "ISO 9241-11:2018 6.3.3 Human effort expended",
    wcag: "WCAG SC 1.3.1 Info and Relationships; SC 2.4.6 Headings and Labels",
  },
  "PHS-1": {
    coga: "COGA: Keep structure predictable",
    iso: "ISO 9241-11:2018 6.3.3 Human effort expended",
    wcag: "WCAG SC 1.3.1 Info and Relationships; SC 2.4.6 Headings and Labels",
  },
  "NC-1": {
    coga: "COGA: Predictable navigation cues",
    iso: "ISO 9241-11:2018 6.3.2 Time used; 6.3.3 Human effort expended",
    wcag: "WCAG SC 2.4.1 Bypass Blocks; SC 2.4.5 Multiple Ways",
  },
  "WIP-1": {
    coga: "COGA: Make the next action obvious",
    iso: "ISO 9241-11:2018 6.2.1 Effectiveness general; 6.3.3 Human effort expended",
    wcag: "WCAG SC 3.2.4 Consistent Identification; SC 2.4.6 Headings and Labels",
  },
  "VO-1": {
    coga: "COGA: Help users focus on the primary task",
    iso: "ISO 9241-11:2018 6.3.3 Human effort expended; 6.4.3 Cognitive responses",
    wcag: "WCAG SC 2.4.3 Focus Order; SC 2.4.6 Headings and Labels",
  },
  "AMC-1": {
    coga: "COGA: Avoid unexpected autoplay triggers",
    iso: "ISO 9241-11:2018 6.4.2 Physical responses; 6.4.4 Emotional responses",
    wcag: "WCAG SC 2.2.2 Pause, Stop, Hide; SC 1.4.2 Audio Control",
  },
  "EI-1": {
    coga: "COGA: Avoid interruptive overlays",
    iso: "ISO 9241-11:2018 6.2.3 Completeness; 6.4.4 Emotional responses",
    wcag: "WCAG SC 3.2.1 On Focus; SC 3.2.2 On Input",
  },
};

const COGA_OBJECTIVE_BY_RULE = {
  "DT-1": "Use Clear and Understandable Content",
  "LC-1": "Use Clear and Understandable Content",
  "SC-1": "Use Clear and Understandable Content",
  "LCC-1": "Use Clear and Understandable Content",
  "PHS-1": "Help Users Understand What Things are and How to Use Them",
  "NC-1": "Help Users Find What They Need",
  "WIP-1": "Help Users Find What They Need",
  "VO-1": "Help Users Focus",
  "AMC-1": "Help Users Focus",
  "EI-1": "Help Users Focus",
};

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
  return PATIENT_PROFILES[state.activeProfile] || PATIENT_PROFILES.Alison;
}

function patientDetectorOrderIndex(name) {
  const order = activePatientProfile().detectorOrder || DETECTOR_NAMES;
  const index = order.indexOf(canonicalDimensionName(name));
  return index === -1 ? dimensionBaseOrderIndex(name) : index;
}

function isDetectorEnabledForActiveProfile(name) {
  const enabledDetectors = activePatientProfile().enabledDetectors;
  if (!enabledDetectors || !enabledDetectors.length) {
    return true;
  }
  return enabledDetectors.includes(canonicalDimensionName(name));
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
  state.activeProfile = profileName;
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
    onDetectionGaugeUpdate({ detected: null, total: null });
    return;
  }

  const total = TOTAL_POSSIBLE_DETECTION_POINTS;
  const detected = detectorsWithIssuesCount(result);
  onDetectionGaugeUpdate({ detected, total });
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
  const tooltipMap = {
    "Dense Text Detection": { issue: "Text blocks may be too dense to scan.", impact: "We check paragraph word count and sentence count." },
    "Language Complexity": { issue: "Vocabulary may be harder to understand quickly.", impact: "We check complex or uncommon word density." },
    "Sentence Complexity": { issue: "Sentences may be too long or heavily connected.", impact: "We check sentence length, commas, and conjunctions." },
    "Long Content Without Chunking": { issue: "Long sections may lack structure.", impact: "We check long main/article/section content without headings or lists." },
    "Poor Heading Structure": { issue: "Heading hierarchy may make orientation harder.", impact: "h1–h6 hierarchy heuristic: missing h1, multiple h1, skipped levels, duplicate or empty headings, or no headings (not title tag or visual typography)." },
    "Navigation Complexity": { issue: "Navigation may create too many choices.", impact: "We check link count and nesting depth." },
    "Weak Information Prominence": { issue: "The next important action may be hard to identify.", impact: "We check competing CTA density." },
    "Visual Overload": { issue: "The viewport may contain too many competing elements.", impact: "We check visible element count and interactive density." },
    "Auto-Moving Content": { issue: "Automatic movement may distract users.", impact: "We check autoplay media and continuously moving components." },
    "Excessive Interruptions": { issue: "Overlays or popups may interrupt the task.", impact: "We check dialogs, modals, sticky prompts, and interruption scripts." },
  };
  return tooltipMap[normalized] || {
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
  const isoText = RULE_FRAMEWORK_MAP[ruleId]?.iso || "";
  const clauses = parseStandardsItems(isoText, /^ISO\s*9241-11(?::2018)?\s*/i)
    .map((item) => item.replace(/^2018\s+/i, "").trim());
  return clauses.length ? clauses : ["6.3.3 Human effort expended"];
}

function parseWcagCriteriaFromRule(ruleId) {
  const wcagText = RULE_FRAMEWORK_MAP[ruleId]?.wcag || "";
  const criteria = parseStandardsItems(wcagText, /^WCAG(?:\s*2\.2)?\s*/i)
    .map((item) => (/^SC\s+/i.test(item) ? item : `SC ${item}`));
  return criteria.length ? criteria : ["SC 2.4.6 Headings and Labels"];
}

function frameworkStandardsForRule(ruleId) {
  const entry = RULE_FRAMEWORK_MAP[ruleId];
  if (!entry) {
    return {
      coga: "COGA: reduce cognitive load in task flow",
      wcagCriteria: ["SC 2.4.6 Headings and Labels"],
      isoClauses: ["6.3.3 Human effort expended"],
      wcagDisplay: "WCAG  SC 2.4.6 Headings and Labels",
      isoDisplay: "ISO 9241-11:2018 6.3.3 Human effort expended",
    };
  }
  const wcagCriteria = parseWcagCriteriaFromRule(ruleId);
  const isoClauses = parseIsoClausesFromRule(ruleId);
  return {
    coga: entry.coga || "COGA: reduce cognitive load in task flow",
    wcagCriteria,
    isoClauses,
    wcagDisplay: `WCAG 2.2 ${wcagCriteria.join("; ")}`,
    isoDisplay: `ISO 9241-11:2018 ${isoClauses.join("; ")}`,
  };
}

/** Short WCAG / ISO lines for left-panel issue cards (not full standards copy). */
function issueCardStandardsSummary(ruleId) {
  const standards = frameworkStandardsForRule(ruleId);
  return {
    coga: COGA_OBJECTIVE_BY_RULE[ruleId] || standards.coga.replace(/^COGA:\s*/i, ""),
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
  state.previousResult = previousResult || null;
  state.previousSourceName = previousSourceName || "";
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

  state.rightPanelMode = "summary";
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

function titleCaseSelectorPart(value) {
  return String(value || "")
    .replace(/^[.#]/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\bcta\b/gi, "CTA")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function controlElementLabel(tag) {
  const normalizedTag = String(tag || "").toLowerCase();
  if (normalizedTag === "a") {
    return "Link";
  }
  if (normalizedTag === "input") {
    return "Input button";
  }
  if (normalizedTag === "button") {
    return "Button";
  }
  return titleCaseSelectorPart(normalizedTag || "Control");
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

function friendlyLocationLabel(location) {
  if (!location || typeof location !== "object") {
    return "Affected page area";
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

function locationMetaText(location, elementNumber = null) {
  if (!location || typeof location !== "object") {
    return "Location detail";
  }
  const elementPrefix = elementNumber ? `Highlighted as Element ${elementNumber} · ` : "";
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

function issueElementChipRowMarkup(issue, dimensionName, location, elementNumber, activeElementNumber) {
  const isActive = activeElementNumber === elementNumber;
  const label = location?.label || friendlyLocationLabel(location);
  const isHighlightable = location?.highlightable !== false;
  const meta = locationMetaText(location, null)
    .replace(/^Location: /, "")
    .replace(/\s*Highlighted as Element \d+\s*·\s*/i, "");
  const showMeta = meta && meta !== label;
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
  return `
    <button
      class="issue-element-chip${isActive ? " is-active" : ""}"
      type="button"
      data-issue-element="${escapeHtml(issue.rule_id)}"
      data-issue-dimension="${escapeHtml(dimensionName)}"
      data-element-index="${elementNumber}"
      aria-pressed="${isActive ? "true" : "false"}"
    >
      <strong>Element ${elementNumber}</strong>
      <span>${escapeHtml(label || `Affected element ${elementNumber}`)}</span>
      ${showMeta ? `<small>${escapeHtml(meta)}</small>` : ""}
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

  if ((issue?.rule_id || "") === "PHS-1") {
    const grouped = groupLocationsByViolationType(shownLocations);
    const keys = orderPhsViolationGroupKeys(Object.keys(grouped));
    const groupedBlocks = keys.map((violationKey) => {
      const entries = grouped[violationKey];
      const groupTitle = `${formatViolationTypeLabel(violationKey)} (${entries.length})`;
      const cards = entries.map(({ location, elementNumber }) => {
        const label = friendlyLocationLabel(location);
        const meta = locationMetaText(location, elementNumber).replace(/^Location: /, "");
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

  // Guidance should show concrete affected elements, not deduplicated labels,
  // so the visible list matches the affected-element count users see above.
  return `
    <div class="guidance-evidence-note">
      <strong>${escapeHtml(`${count} affected element${count === 1 ? "" : "s"} found`)}</strong>
      <span>Each row shows the element type and its approximate page or code location. The numbers match the <strong>Element 1</strong>, <strong>Element 2</strong> labels in the page highlight.</span>
    </div>
    <div class="guidance-location-list">
      ${shownLocations.map((location, index) => {
        const label = friendlyLocationLabel(location);
        const meta = locationMetaText(location, index + 1).replace(/^Location: /, "");
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
  const ruleSteps = {
    "DT-1": [
      "Break long paragraphs or list items into smaller chunks.",
      "Add subheadings, lists, or spacing so readers can scan before reading in full.",
    ],
    "LC-1": [
      "Replace dense or specialist words with familiar terms where possible.",
      "Keep necessary technical terms, but explain them in plain language.",
    ],
    "SC-1": [
      "Split long sentences into shorter, direct statements.",
      "Keep each sentence focused on one main idea.",
    ],
    "LCC-1": [
      "Break long prose into smaller grouped chunks.",
      "Use lists, short sub-sections, or clearly separated steps to reduce scanning effort.",
    ],
    "PHS-1": [
      "Add one clear h1 that describes the page purpose.",
      "Use lower-level headings in order to mark major sections.",
    ],
    "NC-1": [
      "Reduce the number of top-level navigation links.",
      "Flatten deeply nested menus and group related links clearly.",
    ],
    "WIP-1": [
      "Make one primary call to action visually dominant.",
      "Move or demote nearby competing calls to action.",
    ],
    "VO-1": [
      "Reduce competing visible elements in the viewport.",
      "Group related content and remove non-essential cards, banners, or controls.",
    ],
    "AMC-1": [
      "Disable autoplay by default.",
      "Reduce non-essential continuous motion or make it user initiated.",
    ],
    "EI-1": [
      "Avoid showing popups, sticky prompts, or overlays on initial load.",
      "Provide a clear dismiss control and keep prompts out of the primary task flow.",
    ],
  };

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

  const selectedSteps = ruleSteps[ruleId] || fallbackSteps[DIMENSION_CATEGORY_KEYS[category]] || fallbackSteps.structure;
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
  const goals = {
    "DT-1": "Turn dense text blocks into smaller, scannable chunks.",
    "LC-1": "Use familiar wording that users can decode quickly.",
    "SC-1": "Make each sentence short enough to understand without re-reading.",
    "LCC-1": "Break long content into clear sections that users can scan.",
    "PHS-1": "Create a predictable heading hierarchy.",
    "NC-1": "Make navigation choices easier to scan and understand.",
    "WIP-1": "Make one primary action clearly more important than secondary actions.",
    "VO-1": "Reduce competing focal points and support one dominant task path.",
    "AMC-1": "Keep motion under user control instead of starting automatically.",
    "EI-1": "Avoid interruptions before users finish the main reading or task path.",
  };

  if (goals[ruleId]) {
    return goals[ruleId];
  }
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
  const checks = {
    "DT-1": "Done when long text is split into shorter chunks with clear scan points.",
    "LC-1": "Done when key wording is familiar or briefly explained.",
    "SC-1": "Done when each sentence communicates one idea without forcing re-reading.",
    "LCC-1": "Done when users can scan section headings or chunks before reading in full.",
    "PHS-1": "Done when headings follow a clear order from the main page heading down.",
    "NC-1": "Done when navigation has fewer choices and shallow, clear grouping.",
    "WIP-1": "Done when the primary action is visually dominant and secondary actions are grouped.",
    "VO-1": "Done when one clear primary focus is visible above the fold.",
    "AMC-1": "Done when media or animation starts only after the user chooses it.",
    "EI-1": "Done when popups or sticky prompts no longer interrupt the first task path.",
  };

  if (checks[ruleId]) {
    return checks[ruleId];
  }
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
      <code>${escapeHtml(locationMetaText(location).replace(/^Location: /, ""))}</code>
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
          <h4><span>1.</span> Affected elements and locations</h4>
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
        <span class="issue-highlight-label">Affected elements</span>
        <div class="issue-element-tip" role="note" aria-label="Element interaction tip">
          <p class="issue-element-tip-title">Tip</p>
          <ol class="issue-element-tip-steps">
            <li><strong>Click element</strong> -> right preview <strong>highlights</strong> it.</li>
            <li><strong>Hover highlight</strong> -> <strong>guidance</strong> appears (moves away and it hides).</li>
            <li><strong>Click highlight</strong> -> <strong>pin guidance</strong> (click again to close).</li>
          </ol>
        </div>
        <div class="issue-phs-grouped-wrap">
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
      <span class="issue-highlight-label">Affected elements</span>
      <div class="issue-element-tip" role="note" aria-label="Element interaction tip">
        <p class="issue-element-tip-title">Tip</p>
        <ol class="issue-element-tip-steps">
          <li><strong>Click element</strong> -> right preview <strong>highlights</strong> it.</li>
          <li><strong>Hover highlight</strong> -> <strong>guidance</strong> appears (moves away and it hides).</li>
          <li><strong>Click highlight</strong> -> <strong>pin guidance</strong> (click again to close).</li>
        </ol>
      </div>
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
    state.selectedElementNumber = 0;
    state.activeGuidancePopoverKey = "";
  }
  state.selectedIssueId = issueId;
  updateActiveHighlightButtons();
  return selected;
}

function selectedIssueRecord() {
  return findIssueById(state.selectedIssueId);
}

function resetIssueWorkspaceForProfileChange() {
  // Switching priority lens resets issue guidance/highlights because detector prioritization changed.
  state.selectedIssueId = "";
  state.activeHighlightDimension = "";
  state.activeHighlightIssueId = "";
  state.selectedElementNumber = 0;
  state.activeGuidancePopoverKey = "";
  state.rightPanelMode = "summary";

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
  const locationElements = (issue.locations || []).flatMap((location) => (
    findElementsForLocation(frameDoc, location)
  ));
  if (locationElements.length) {
    return { elements: locationElements, exact: true };
  }

  const ruleId = issue?.rule_id || "";
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
    state.selectedIssueId = "";
    state.activeHighlightDimension = "";
    state.activeHighlightIssueId = "";
    state.rightPanelMode = "summary";
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

  state.rightPanelMode = "detail";
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
    state.selectedIssueId = "";
    state.activeHighlightDimension = "";
    state.activeHighlightIssueId = "";
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
  state.rightPanelMode = "preview";
  state.activeHighlightDimension = selected.dimension.dimension;
  state.activeHighlightIssueId = issueDomId(selected.dimension.dimension, selected.issue.rule_id);
  setWorkspaceMode("website");
  updateActiveHighlightButtons();
  runHighlightAfterIframeLayoutStable(() => highlightSelectedIssueInPreview());
}

/** Standards + affected elements (formerly nested inside a second &lt;details&gt;). */
function issueSummaryBodyMarkup(issue, dimensionName) {
  const { coga: cogaSummary, iso: isoSummary } = issueCardStandardsSummary(issue.rule_id || "");
  const cogaMarkup = cogaGuidanceMarkup(cogaSummary);
  const isoMarkup = standardsPillsMarkup(isoSummary, "Effectiveness, efficiency, satisfaction.");

  return `
        <details class="issue-learn-more">
          <summary class="issue-learn-more-summary">Learn more</summary>
          <div class="issue-learn-more-content">
            <div class="issue-summary-row issue-summary-row-standards">
              <span class="issue-highlight-label issue-highlight-label--wcag-guidance">W3C COGA Guidance Objective</span>
              ${cogaMarkup}
            </div>
            <div class="issue-summary-row issue-summary-row-standards">
              <span class="issue-highlight-label">ISO 9241-11</span>
              ${isoMarkup}
            </div>
          </div>
        </details>
        ${issueElementListMarkup(issue, dimensionName)}
  `;
}

/**
 * One accordion per issue: expand once to see cognitive helper + standards + elements (no nested Issue card).
 */
function topIssueAccordionMarkup(issue, dimensionName, issueNumber, displayName, cognitiveDimension) {
  const issueId = issueDomId(dimensionName, issue.rule_id);
  const isSelected = issueId === state.selectedIssueId;
  const selectedClass = isSelected ? " is-selected is-active" : "";
  const titleText = issue.title || "Review this issue";
  const bodyMarkup = issueSummaryBodyMarkup(issue, dimensionName);
  const titleDiffersFromDetector = String(titleText).trim() !== String(displayName).trim();
  const issueTitleRow = titleDiffersFromDetector
    ? `<p class="issue-flat-issue-title"><strong>${escapeHtml(titleText)}</strong></p>`
    : "";

  return `
    <details
      class="explanation-block explanation-accordion issue-highlight-button issue-summary-card${selectedClass}"
      data-explanation-dimension="${escapeHtml(displayName)}"
      data-highlight-issue="${escapeHtml(issue.rule_id)}"
      data-highlight-dimension="${escapeHtml(dimensionName)}"
    >
      <summary class="explanation-accordion-summary">
        <span class="explanation-accordion-title">${escapeHtml(displayName)}</span>
        <span class="explanation-accordion-meta">
          <span class="explanation-accordion-issue-count">${issueNumber}</span>
          <span class="explanation-accordion-chevron" aria-hidden="true">▾</span>
        </span>
      </summary>
      <div class="explanation-accordion-content">
        <p class="category-helper">${escapeHtml(cognitiveDimension)}</p>
        ${issueTitleRow}
        <div class="issue-summary-body">
          ${bodyMarkup}
        </div>
      </div>
    </details>
  `;
}

function renderExplanation(result) {
  const explanationContent = document.getElementById("explanationContent");
  if (!explanationContent) {
    return;
  }

  const orderedDimensions = [...(result.dimensions || [])]
    .filter((dimension) => isDetectorEnabledForActiveProfile(dimension?.dimension))
    .sort((left, right) => patientDetectorOrderIndex(left?.dimension) - patientDetectorOrderIndex(right?.dimension));

  let issueSeq = 0;
  const blocks = orderedDimensions.flatMap((dimension) => {
    const filteredIssues = prioritizedIssuesForProfile(dimension);
    if (!filteredIssues.length) {
      return [];
    }

    const displayName = displayDimensionName(dimension.dimension);
    const cognitiveDimension = cognitiveDimensionLabel(dimension.dimension);

    return filteredIssues.map((issue) => {
      issueSeq += 1;
      return topIssueAccordionMarkup(issue, dimension.dimension, issueSeq, displayName, cognitiveDimension);
    });
  });

  explanationContent.className = "pane-scroll rich-text";
  explanationContent.innerHTML = blocks.length
    ? `<div class="issue-highlight-list">${blocks.join("")}</div>`
    : `<p class="category-helper">No top issues detected for this scan.</p>`;
  setActiveDimensionBar("");
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
  state.workspaceMode = mode;
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
      padding: 12px 14px;
      font: 500 13px/1.45 Arial, sans-serif;
      color: #0f172a;
    }

    #cognilens-guidance-popover .cognilens-popover-close {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 24px;
      height: 24px;
      border: 1px solid rgba(148, 163, 184, 0.65);
      border-radius: 999px;
      background: #fff;
      color: #475569;
      font: 800 14px/1 Arial, sans-serif;
      cursor: pointer;
    }

    #cognilens-guidance-popover .cognilens-popover-close:hover,
    #cognilens-guidance-popover .cognilens-popover-close:focus-visible {
      border-color: rgba(37, 99, 235, 0.8);
      color: #1d4ed8;
      outline: none;
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
  state.activeGuidancePopoverKey = "";
  state.previewGuidancePinned = false;
}

function positionGuidancePopover(popoverEl, anchorElement, doc) {
  const anchorRect = anchorElement.getBoundingClientRect();
  const popoverRect = popoverEl.getBoundingClientRect();
  const maxLeft = Math.max(8, (doc.documentElement?.clientWidth || 0) - popoverRect.width - 8);
  const left = Math.min(Math.max(8, anchorRect.left + 8), maxLeft);
  const top = Math.max(8, anchorRect.bottom + 10 + (doc.defaultView?.scrollY || 0));
  popoverEl.style.left = `${left}px`;
  popoverEl.style.top = `${top}px`;
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
    <button type="button" class="cognilens-popover-close" aria-label="Close guidance popover">×</button>
    <h5>${escapeHtml(elementLabel)}</h5>
    <h5>Why this matters</h5>
    <p>${escapeHtml(issue.description || "This pattern can increase cognitive load and interrupt users' task flow.")}</p>
    <h5>First redesign move</h5>
    ${listMarkup}
  `;
  doc.body?.appendChild(container);
  state.activeGuidancePopoverKey = expectedKey;
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

function validateHighlightTarget(element, location = null, frameDoc = null) {
  if (!element || element.nodeType !== 1) {
    return { ok: false, reason: "No visible target found" };
  }
  const tagName = element.tagName?.toLowerCase();
  if (["html", "head", "body", "script", "style", "meta", "link", "noscript", "template", "defs", "path"].includes(tagName)) {
    return { ok: false, reason: `Bad target tag: ${tagName}` };
  }
  const hiddenReason = elementHiddenReason(element);
  if (hiddenReason) {
    return { ok: false, reason: hiddenReason };
  }
  const rect = element.getBoundingClientRect();
  const viewportWidth = frameDoc?.documentElement?.clientWidth || element.ownerDocument?.documentElement?.clientWidth || 0;
  const viewportHeight = frameDoc?.documentElement?.clientHeight || element.ownerDocument?.documentElement?.clientHeight || 0;
  if (viewportWidth && viewportHeight && rect.width * rect.height > viewportWidth * viewportHeight * 0.6) {
    return { ok: false, reason: "Target is a large structural container" };
  }
  if (location?.selector && isGenericOrBadSelector(location.selector)) {
    return { ok: false, reason: `Selector is too broad: ${location.selector}` };
  }
  return { ok: true, reason: "" };
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

function findElementsForLocation(doc, location) {
  if (!location || typeof location !== "object") {
    return [];
  }

  if (location.highlightable === false || location.documentStructuralFinding === true) {
    return [];
  }

  if (location.cognilensId) {
    const selector = `[data-cognilens-id="${cssEscape(location.cognilensId)}"]`;
    const matched = Array.from(doc.querySelectorAll(selector));
    debugHighlight("cognilensId lookup", location.cognilensId, "matches", matched.length);
    if (matched.length) {
      return sortHighlightCandidates(matched);
    }
  }

  if (location.selector) {
    if (isGenericOrBadSelector(location.selector)) {
      debugHighlight("skip broad/bad selector", location.selector);
    } else {
      try {
        const matched = Array.from(doc.querySelectorAll(location.selector));
        debugHighlight("selector lookup", location.selector, "matches", matched.length);
        debugCandidateList(`selector ${location.selector}`, matched, doc);
        if (matched.length) {
          return sortHighlightCandidates(matched);
        }
      } catch (error) {
        debugHighlight("selector lookup failed", location.selector, error);
        return [];
      }
    }
  }

  const summarySelector = summaryToSelector(location.summary || location.region);
  if (summarySelector) {
    try {
      const matched = Array.from(doc.querySelectorAll(summarySelector));
      debugHighlight("summary selector lookup", summarySelector, "matches", matched.length);
      debugCandidateList(`summary selector ${summarySelector}`, matched, doc);
      if (matched.length) {
        return sortHighlightCandidates(matched);
      }
    } catch (error) {
      // Fall through to other location strategies.
    }
  }

  if (location.block_index) {
    const block = collectTextBlocks(doc)[Number(location.block_index) - 1];
    if (block) {
      return [block];
    }
  }

  if (location.text) {
    const matched = findByText(doc, location.tag, location.text);
    debugHighlight("text fallback", location.text, "matches", matched.length);
    debugCandidateList("text fallback", matched, doc);
    if (matched.length) {
      return sortHighlightCandidates(matched);
    }
  }

  if (location.preview) {
    const matched = findByText(doc, location.tag, location.preview);
    debugHighlight("preview fallback", location.preview, "matches", matched.length);
    debugCandidateList("preview fallback", matched, doc);
    if (matched.length) {
      return sortHighlightCandidates(matched);
    }
  }

  if (location.sentence_preview) {
    const matched = findByText(doc, location.tag, location.sentence_preview);
    debugHighlight("sentence preview fallback", location.sentence_preview, "matches", matched.length);
    debugCandidateList("sentence preview fallback", matched, doc);
    if (matched.length) {
      return sortHighlightCandidates(matched);
    }
  }

  if (location.label || location.summary) {
    const text = location.label || location.summary;
    const matched = findByText(doc, location.tag, text);
    debugHighlight("label/summary fallback", text, "matches", matched.length);
    debugCandidateList("label/summary fallback", matched, doc);
    if (matched.length) {
      return sortHighlightCandidates(matched);
    }
  }

  return [];
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

function moreSpecificHighlightTarget(element, location = null, frameDoc = null) {
  const validation = validateHighlightTarget(element, location, frameDoc);
  if (validation.ok) {
    return element;
  }
  const childSelectors = "a, button, input, select, textarea, img, h1, h2, h3, h4, p, li, video, audio, iframe, [role='button']";
  const children = Array.from(element?.querySelectorAll?.(childSelectors) || []);
  const child = sortHighlightCandidates(children).find((candidate) => (
    validateHighlightTarget(candidate, null, frameDoc).ok
  ));
  if (child) {
    debugHighlight("using more specific child target", {
      originalReason: validation.reason,
      originalTag: element?.tagName?.toLowerCase(),
      childTag: child.tagName?.toLowerCase(),
      childText: elementTextPreview(child),
    });
    return child;
  }
  return element;
}

function fallbackSelectorsForIssue(issue, dimensionName) {
  const ruleId = issue?.rule_id || "";
  if (ruleId === "DT-1" || ruleId === "LC-1" || ruleId === "SC-1" || ruleId === "LCC-1") {
    return ["p", "li", "article", "section", "label", "legend", "small"];
  }
  if (ruleId === "PHS-1") {
    return [];
  }
  if (ruleId === "NC-1") {
    return ["nav", "[role='navigation']", "[class*='menu' i]", "[class*='breadcrumb' i]"];
  }
  if (ruleId === "WIP-1") {
    return [];
  }
  if (ruleId === "VO-1") {
    return ["main > *", "header > *", "section", "article", "nav", "button", "a", "img", "h1", "h2", ".card", "[class*='card' i]"];
  }
  if (ruleId === "AMC-1") {
    return ["video[autoplay]", "audio[autoplay]", "iframe"];
  }
  if (ruleId === "EI-1") {
    return ["dialog", "[role='dialog']", "[role='alertdialog']", "[aria-modal='true']", "[aria-live]", "[class*='modal' i]", "[class*='popup' i]", "[class*='overlay' i]", "[class*='toast' i]", "[class*='notification' i]", "[class*='sticky' i]", "[class*='chat' i]", "[class*='cookie' i]", "[class*='consent' i]"];
  }
  return HIGHLIGHT_CONFIG[dimensionName]?.selectors || [];
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
  const exactLocationElements = location ? findElementsForLocation(frameDoc, location) : [];
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

  let finalTarget = moreSpecificHighlightTarget(target, location, frameDoc);
  if (!isElementVisibleForHighlight(finalTarget)) {
    const expanded = tryExpandHiddenElement(finalTarget);
    if (expanded) {
      setWebsiteStatus(`Element ${elementNumber} is inside hidden content. Opening its section...`);
      await waitForPreviewUpdate();
      const retry = location ? findElementsForLocation(frameDoc, location) : issueHighlightElements(frameDoc, issue, dimensionName).elements;
      finalTarget = moreSpecificHighlightTarget(
        sortHighlightCandidates(retry)[exactLocationElements.length ? 0 : elementNumber - 1] || finalTarget,
        location,
        frameDoc,
      );
      debugHighlight("after auto expand retry", {
        candidates: retry.length,
        finalTarget,
        visible: isElementVisibleForHighlight(finalTarget),
        hiddenReason: elementHiddenReason(finalTarget),
      });
    }
  }

  const targetValidation = validateHighlightTarget(finalTarget, location, frameDoc);
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
    state.selectedElementNumber = 0;
    state.activeHighlightIssueId = "";
    state.activeHighlightDimension = "";
    state.activeGuidancePopoverKey = "";
    clearWebsiteHighlights();
    updateActiveHighlightButtons();
    setWebsiteStatus("Highlight cleared. Click an element again to re-highlight it.");
    return;
  }

  const selected = selectIssue(dimensionName, ruleId);
  if (!selected) {
    return;
  }
  state.rightPanelMode = "preview";
  state.activeHighlightDimension = selected.dimension.dimension;
  state.activeHighlightIssueId = issueDomId(selected.dimension.dimension, selected.issue.rule_id);
  state.selectedElementNumber = elementNumber;
  state.activeGuidancePopoverKey = "";
  setWorkspaceMode("website");
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
    state.activeHighlightDimension = "";
    updateActiveHighlightButtons();
    setWebsiteStatus("Highlight cleared. The original webpage view is restored.");
    return;
  }

  state.activeHighlightDimension = dimensionName;
  state.activeHighlightIssueId = "";
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
    state.activeHighlightIssueId = "";
    state.activeHighlightDimension = "";
    updateActiveHighlightButtons();
    setWebsiteStatus("Highlight cleared. The original webpage view is restored.");
    return;
  }

  state.activeHighlightDimension = dimensionName;
  state.activeHighlightIssueId = issueId;
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
    overall_score: result.overall_score,
    weighted_average: result.weighted_average,
    min_dimension_score: result.min_dimension_score,
    profile_scores: result.profile_scores || [],
    dimensions: result.dimensions.map((dimension) => ({
      dimension: dimension.dimension,
      issue_category_label: displayIssueCategoryName(dimension.dimension),
      cognitive_dimension: cognitiveDimensionLabel(dimension.dimension),
      score: dimension.score,
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
  state.chatMessages = [
      {
        role: "assistant",
        content: "Ask me how to reduce information overload, improve readability, or fix specific issues.",
      },
  ];
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

  state.chatMessages.push({ role: "user", content: prompt });
  input.value = "";
  state.chatPending = true;
  renderAssistantMessages();

  try {
    const response = await chatWithAssistant({
      message: prompt,
      analysis_context: buildAssistantContext(),
      source_name: state.sourceName || "Uploaded file",
    });

    state.chatMessages.push({
      role: "assistant",
      content: response.reply || "No assistant response was returned.",
    });
  } catch (error) {
    state.chatMessages.push({
      role: "assistant",
      content: `I could not reach the AI assistant right now. ${error.message || String(error)}`,
    });
  } finally {
    state.chatPending = false;
    renderAssistantMessages();
    input.focus();
  }
}

function handleAssistantClear() {
  state.chatMessages = [];
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
  state.currentResult = result;
  state.currentHtml = html || "";
  if (options.preserveSelectedIssue && findIssueById(previousSelectedIssueId)) {
    state.selectedIssueId = previousSelectedIssueId;
  } else {
    state.selectedIssueId = "";
    state.rightPanelMode = "summary";
  }
  renderReportId();
  renderScoreSlider(result);
  renderDashboardSummary(result);
  renderDetectionGauge(result);
  renderPrintSummary(result);
  renderPrintableProfileReport(result);
  renderExplanation(result);
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
  state.sidebarCollapsed = !state.sidebarCollapsed;
  sessionStorage.setItem(SIDEBAR_STORAGE_KEY, String(state.sidebarCollapsed));
  applySidebarState();
}

function initSidebar() {
  window.removeEventListener("resize", applySidebarState);
  state.sidebarCollapsed = sessionStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
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

  state.assistantFloatingOpen = isOpen;
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
    setAssistantFloatingOpen(true);
  });

  if (minimizeButton) {
    minimizeButton.addEventListener("click", () => {
      setAssistantFloatingOpen(false);
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

  if (printButton) {
    printButton.addEventListener("click", () => {
      printDashboardReport({ restoreMode: state.workspaceMode });
    });
  }

  if (sidebarToggleButton) {
    sidebarToggleButton.addEventListener("click", handleSidebarToggle);
  }

  document.querySelectorAll("[data-patient-profile]").forEach((button) => {
    button.addEventListener("click", () => {
      setActivePatientProfile(button.dataset.patientProfile || "Alison");
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
        highlightIssue(button.dataset.highlightDimension, button.dataset.highlightIssue);
      } else {
        highlightDimension(button.dataset.highlightDimension);
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
      focusIssueElement(
        issueElementTrigger.dataset.issueDimension,
        issueElementTrigger.dataset.issueElement,
        Number(issueElementTrigger.dataset.elementIndex || "1"),
      );
      return;
    }

    const trigger = event.target.closest("[data-highlight-issue]");
    if (!trigger) {
      return;
    }
    if (trigger.classList.contains("issue-summary-card")) {
      return;
    }
    highlightIssue(trigger.dataset.highlightDimension, trigger.dataset.highlightIssue);
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
  const current = storedSession?.current;
  const hasHtml = Boolean(current?.html || current?.payload?.html_content);
  const runId = current?.payload?.run?.run_id || current?.payload?.run?.id || current?.payload?.run_id;
  if (!current?.payload || hasHtml || !runId) {
    return storedSession;
  }

  try {
    const detail = await fetchJson(`${API_BASE}/history/${encodeURIComponent(runId)}`);
    const hydrated = buildDashboardSessionFromHistoryDetail(detail);
    return {
      ...storedSession,
      current: {
        ...current,
        ...hydrated.current,
        payload: {
          ...current.payload,
          ...hydrated.current.payload,
        },
      },
    };
  } catch (error) {
    return storedSession;
  }
}

async function loadDashboardSessionWithHistoryFallback() {
  const runId = getHistoryReportRunIdFromUrl();
  if (runId) {
    const detail = await fetchJson(`${API_BASE}/history/${encodeURIComponent(runId)}`);
    return buildDashboardSessionFromHistoryDetail(detail);
  }

  const storedSession = loadDashboardSession();
  return hydrateStoredDashboardSession(storedSession);
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
  initSidebar();
  bindEvents();

  const session = await loadDashboardSessionWithHistoryFallback();
  if (lifecycleSnapshot !== getDashboardLifecycleSnapshot()) {
    return;
  }
  const currentSession = session?.current;
  const previousSession = session?.previous;
  if (!currentSession?.payload) {
    renderMissingAnalysisState();
    return;
  }

  const currentResult = buildAnalysisView(currentSession.payload);
  const previousResult = previousSession?.payload ? buildAnalysisView(previousSession.payload) : null;
  const sourceNode = document.getElementById("dashboardSourceName");
  if (!isHistoryReportView()) {
    clearHistoryReportContext();
  }
  state.currentPayload = currentSession.payload;
  state.sourceName = currentSession.sourceName || currentSession.payload?.run?.source_name || "Uploaded file";
  state.sourceUrl = currentSession.sourceUrl || (isProbablyUrl(state.sourceName) ? state.sourceName : "");
  state.sourceType = currentSession.sourceType || "";
  if (sourceNode) {
    sourceNode.textContent = state.sourceName;
  }

  syncEyeTrackingNavAndStorage();

  renderResult(
    currentResult,
    currentSession.html || currentSession.payload.html_content || "",
  );
  initHistoryContextPanel();
  renderComparison(currentResult, previousResult, previousSession?.sourceName || "");
  // Default first entry to the raw website preview.
  setWorkspaceMode("website");
  loadPreviewOnSessionStart();

  if (sessionStorage.getItem(AUTO_PRINT_STORAGE_KEY) === "true") {
    sessionStorage.removeItem(AUTO_PRINT_STORAGE_KEY);
    window.setTimeout(() => {
      printDashboardReport();
    }, 150);
  }
}

export function notifyDashboardUnmount() {
  onDetectionGaugeUpdate = null;
  bumpDashboardLifecycle();
}

export async function initDashboard(options = {}) {
  onDetectionGaugeUpdate =
    typeof options.onDetectionGaugeUpdate === "function" ? options.onDetectionGaugeUpdate : null;

  const snapshot = getDashboardLifecycleSnapshot();
  try {
    await init(snapshot);
  } catch (error) {
    if (snapshot !== getDashboardLifecycleSnapshot()) {
      return;
    }
    document.body.innerHTML = `<pre style="padding:24px;">${escapeHtml(String(error))}</pre>`;
  }
}
