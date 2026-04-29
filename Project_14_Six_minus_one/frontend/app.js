import {
  API_BASE,
  analyzeHtmlText,
  analyzeVisualComplexityHtml,
  buildAnalysisView,
  chatWithAssistant,
  escapeHtml,
  findDimension,
  formatShortId,
  loadDashboardSession,
  saveDashboardSession,
} from "./common.js?v=id-sync-1";

const state = {
  currentHtml: "",
  currentResult: null,
  currentPayload: null,
  sourceName: "",
  sourceUrl: "",
  workspaceMode: "explanation",
  rightPanelMode: "summary",
  activeHighlightDimension: "",
  activeHighlightIssueId: "",
  selectedIssueId: "",
  chatMessages: [],
  chatPending: false,
  sidebarCollapsed: false,
  assistantFloatingOpen: false,
  renderedDomAnalysisKey: "",
  renderedDomAnalysisPending: false,
  renderedDomAnalysisTimer: null,
  previousResult: null,
  previousSourceName: "",
};

const SIDEBAR_STORAGE_KEY = "cognilens.sidebar.collapsed";
const SIDEBAR_WIDTH_STORAGE_KEY = "cognilens.sidebar.width";
const ASSISTANT_POSITION_STORAGE_KEY = "cognilens.assistant.position";
const AUTO_PRINT_STORAGE_KEY = "cognilens.dashboard.autoPrint";
const DEFAULT_SIDEBAR_WIDTH = 360;
const MIN_SIDEBAR_WIDTH = 320;
const MAX_SIDEBAR_WIDTH = 560;
const ASSISTANT_MARGIN = 16;
const ASSISTANT_LONG_PRESS_MS = 220;
const ASSISTANT_DRAG_CANCEL_DISTANCE = 8;

const INFORMATION_OVERLOAD_NAME = "Information Overload";
const LEGACY_INFORMATION_OVERLOAD_NAME = "Visual Complexity";
const ISSUE_CATEGORY_CONFIG = {
  IO: {
    displayName: "Information Overload Issue",
    cognitiveDimension: "Information Filtering / Visual Prioritisation",
  },
  RD: {
    displayName: "Readability Issue",
    cognitiveDimension: "Reading Load / Comprehension",
  },
  ID: {
    displayName: "Interaction & Distraction Issue",
    cognitiveDimension: "Attention Regulation / Task Continuity",
  },
  CS: {
    displayName: "Consistency & Predictability Issue",
    cognitiveDimension: "Predictability / Wayfinding",
  },
};
const DIMENSION_CATEGORY_KEYS = {
  [INFORMATION_OVERLOAD_NAME]: "IO",
  [LEGACY_INFORMATION_OVERLOAD_NAME]: "IO",
  Readability: "RD",
  "Interaction & Distraction": "ID",
  Consistency: "CS",
};
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

const RULE_FRAMEWORK_MAP = {
  "IO-1": {
    coga: "COGA: Help users focus on the primary task",
    iso: "ISO 9241-11: Efficiency and satisfaction",
    wcag: "WCAG: Understandable content structure",
  },
  "IO-2": {
    coga: "COGA: Reduce cognitive load from dense regions",
    iso: "ISO 9241-11: Efficiency",
    wcag: "WCAG: Understandable grouping and chunking",
  },
  "IO-3": {
    coga: "COGA: Minimize competing peripheral content",
    iso: "ISO 9241-11: Satisfaction and comfort",
    wcag: "WCAG: Understandable page purpose",
  },
  "IO-4": {
    coga: "COGA: Make the next action obvious",
    iso: "ISO 9241-11: Effectiveness",
    wcag: "WCAG: Predictable operation",
  },
  "IO-5": {
    coga: "COGA: Keep a clear information hierarchy",
    iso: "ISO 9241-11: Effectiveness and efficiency",
    wcag: "WCAG: Semantic heading structure",
  },
  "RD-1": {
    coga: "COGA: Use shorter, easier language",
    iso: "ISO 9241-11: Effectiveness",
    wcag: "WCAG: Readable text and comprehension",
  },
  "RD-2": {
    coga: "COGA: Break content into manageable chunks",
    iso: "ISO 9241-11: Efficiency",
    wcag: "WCAG: Understandable content blocks",
  },
  "RD-3": {
    coga: "COGA: Use clear action labels",
    iso: "ISO 9241-11: Effectiveness",
    wcag: "WCAG: Input purpose clarity",
  },
  "RD-4": {
    coga: "COGA: Prefer familiar vocabulary",
    iso: "ISO 9241-11: Effectiveness and satisfaction",
    wcag: "WCAG: Understandable wording",
  },
  "RD-5": {
    coga: "COGA: Keep instructions explicit and direct",
    iso: "ISO 9241-11: Effectiveness",
    wcag: "WCAG: Understandable instructions",
  },
  "RD-6": {
    coga: "COGA: Support scanning with chunking",
    iso: "ISO 9241-11: Efficiency",
    wcag: "WCAG: Understandable content organization",
  },
  "ID-1": {
    coga: "COGA: Avoid unexpected autoplay triggers",
    iso: "ISO 9241-11: Satisfaction and comfort",
    wcag: "WCAG: Provide user control over media",
  },
  "ID-2": {
    coga: "COGA: Reduce distracting motion",
    iso: "ISO 9241-11: Satisfaction",
    wcag: "WCAG: Animation and motion control",
  },
  "ID-3": {
    coga: "COGA: Avoid interruptive overlays",
    iso: "ISO 9241-11: Effectiveness and satisfaction",
    wcag: "WCAG: Predictable interactions",
  },
  "CS-1": {
    coga: "COGA: Keep structure predictable",
    iso: "ISO 9241-11: Efficiency and confidence",
    wcag: "WCAG: Consistent heading hierarchy",
  },
  "CS-2": {
    coga: "COGA: Keep users oriented in multi-step tasks",
    iso: "ISO 9241-11: Effectiveness",
    wcag: "WCAG: Location and progress cues",
  },
  "CS-3": {
    coga: "COGA: Use consistent action wording",
    iso: "ISO 9241-11: Effectiveness and efficiency",
    wcag: "WCAG: Consistent identification",
  },
};

const RULE_BENEFICIARY_TAGS = {
  IO: ["Reading difficulties", "Attention regulation"],
  RD: ["Reading difficulties", "Communication differences"],
  ID: ["Attention regulation", "Autistic users"],
  CS: ["Autistic users", "Executive function support"],
};

const HIGHLIGHT_CONFIG = {
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
  [LEGACY_INFORMATION_OVERLOAD_NAME]: {
    color: "#df3e53",
    selectors: [
      "main",
      "section",
      "article",
      "aside",
      "nav",
      "header",
      ".card",
      "[class*='card' i]",
      "[class*='grid' i]",
      "[class*='banner' i]",
      "[class*='sidebar' i]",
    ],
  },
  Readability: {
    color: "#2493dd",
    selectors: [
      "p",
      "li",
      "article",
      "section p",
      "button",
      "a",
    ],
  },
  "Interaction & Distraction": {
    color: "#f0c400",
    selectors: [
      "dialog",
      "[role='dialog']",
      "[role='alertdialog']",
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
      "[class*='notification' i]",
      "[class*='sticky' i]",
      "[class*='chat' i]",
      "[class*='cookie' i]",
      "[class*='consent' i]",
      "[class*='carousel' i]",
      "[class*='slider' i]",
      "[class*='marquee' i]",
    ],
  },
  Consistency: {
    color: "#8d28df",
    selectors: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "nav",
      "[aria-label*='breadcrumb' i]",
      "[class*='breadcrumb' i]",
      "progress",
      "[aria-current='page']",
    ],
  },
};

function scoreStatus(score) {
  if (score >= 85) return "Strong";
  if (score >= 70) return "Moderate";
  return "Weak";
}

function profileDisplayMeta(name) {
  const meta = PROFILE_DISPLAY_CONFIG[name];
  if (meta) {
    return meta;
  }

  return {
    label: name,
    subtitle: "Audience lens",
  };
}

function displayProfileName(name) {
  return profileDisplayMeta(name).label;
}

function canonicalDimensionName(name) {
  return isInformationOverloadDimension(name) ? INFORMATION_OVERLOAD_NAME : name;
}

function buildOverallDimensionEntries(result) {
  return DIMENSION_CONFIG.map(({ name, className }) => {
    const dimension = findDimension(result, name);
    return {
      name,
      className,
      score: dimension ? dimension.score : 0,
      issueCount: dimension?.issues?.length || 0,
    };
  });
}

function buildProfileDimensionEntries(result, profileName) {
  const weights = profileDisplayMeta(profileName).weights || {};
  return DIMENSION_CONFIG.map(({ name, className }) => {
    const dimension = findDimension(result, name);
    const rawScore = dimension ? dimension.score : 0;
    const issueCount = dimension?.issues?.length || 0;
    const weight = weights[canonicalDimensionName(name)] ?? 0.25;
    const sensitivityMultiplier = weight / 0.25;
    const adjustedScore = Math.max(
      0,
      Math.min(100, Math.round(100 - ((100 - rawScore) * sensitivityMultiplier))),
    );

    return {
      name,
      className,
      score: adjustedScore,
      issueCount,
    };
  });
}

function deltaMeta(currentScore, previousScore) {
  const delta = currentScore - previousScore;
  return {
    delta,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
    label: delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${delta}`,
  };
}

function buildScoreSlides(result) {
  const slides = [];

  (result.profile_scores || []).forEach((profile) => {
    const meta = profileDisplayMeta(profile.name);
    slides.push({
      label: meta.label,
      dimensionEntries: buildProfileDimensionEntries(result, profile.name),
    });
  });

  return slides;
}

function renderScoreSlider(result) {
  const profileNode = document.getElementById("profileScores");
  if (!profileNode) {
    return;
  }

  const slides = buildScoreSlides(result);
  if (!slides.length) {
    profileNode.innerHTML = `<p class="profile-scores-empty">Score lenses will appear after analysis.</p>`;
    return;
  }

  profileNode.innerHTML = `
    <div class="score-slider-tabs" aria-label="Score lens navigation">
      ${slides.map((slide, index) => `
        <button
          type="button"
          class="score-slider-tab${index === 0 ? " is-active" : ""}"
          data-score-dot="${index}"
          aria-label="Select ${escapeHtml(slide.label)} lens"
          aria-pressed="${index === 0 ? "true" : "false"}"
        >${escapeHtml(slide.label)}</button>
      `).join("")}
    </div>
  `;

  const dotNodes = [...profileNode.querySelectorAll("[data-score-dot]")];

  if (!dotNodes.length) {
    return;
  }

  let currentIndex = 0;

  const updateControls = () => {
    dotNodes.forEach((dot, index) => {
      const active = index === currentIndex;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-pressed", active ? "true" : "false");
    });
    renderDimensionBars(slides[currentIndex]?.dimensionEntries || []);
  };

  const goToSlide = (targetIndex) => {
    currentIndex = Math.max(0, Math.min(dotNodes.length - 1, targetIndex));
    updateControls();
  };

  dotNodes.forEach((dot) => {
    dot.addEventListener("click", () => goToSlide(Number(dot.dataset.scoreDot)));
  });

  updateControls();
}

function normalizedScore(score) {
  return Math.max(0, Math.min(100, Number(score) || 0));
}

function scoreBandClass(score) {
  const value = normalizedScore(score);
  if (value <= 33) {
    return "score-low";
  }
  if (value <= 66) {
    return "score-mid";
  }
  return "score-high";
}

function renderDimensionBars(dimensionEntries) {
  const dimensionBars = document.getElementById("dimensionBars");
  if (!dimensionBars) {
    return;
  }

  const dimensionRows = (dimensionEntries || []).map(({ name, score }) => {
    const value = normalizedScore(score);
    const dimensionKey = displayDimensionName(name);
    const issueCategoryName = displayIssueCategoryName(name);
    const tooltipCopy = tooltipCopyForDimension(dimensionKey);
    return `
      <button class="dimension-row dimension-highlight-trigger" type="button" data-highlight-dimension="${escapeHtml(name)}" data-dimension-key="${escapeHtml(dimensionKey)}" aria-label="Highlight ${escapeHtml(issueCategoryName)} on the website">
        <span class="dimension-label-with-info">
          <span>${escapeHtml(issueCategoryName)}</span>
          <span
            class="dimension-info-icon"
            tabindex="0"
            role="button"
            aria-label="${escapeHtml(`${issueCategoryName} info`)}"
            data-tip-issue="${escapeHtml(tooltipCopy.issue)}"
            data-tip-impact="${escapeHtml(tooltipCopy.impact)}"
            data-tip-fix="${escapeHtml(tooltipCopy.fix)}"
          >i</span>
        </span>
        <div class="bar-track"><div class="bar-fill ${scoreBandClass(value)}" style="width:${value}%"></div></div>
        <strong>${value}</strong>
      </button>
    `;
  }).join("");

  dimensionBars.innerHTML = dimensionRows;
}

function renderDashboardSummary(result) {
  const summaryNode = document.getElementById("dashboardSummaryText");

  if (!summaryNode) {
    return;
  }

  const totalIssues = result.dimensions.reduce(
    (count, dimension) => count + (dimension.issues?.length || 0),
    0,
  );

  summaryNode.innerHTML = `
    <div class="summary-line summary-issues">Total number of issues: ${totalIssues} issues detected</div>
  `;
}

function renderReportId() {
  const reportIdNode = document.getElementById("reportIdValue");
  if (!reportIdNode) {
    return;
  }
  const runId = state.currentPayload?.run?.run_id || "";
  reportIdNode.textContent = formatShortId(runId, "R-");
  reportIdNode.title = runId || "";
}

const SEVERITY_RANK = {
  critical: 3,
  major: 2,
  minor: 1,
};

function isInformationOverloadDimension(name) {
  return name === INFORMATION_OVERLOAD_NAME || name === LEGACY_INFORMATION_OVERLOAD_NAME;
}

function displayDimensionName(name) {
  return isInformationOverloadDimension(name) ? INFORMATION_OVERLOAD_NAME : name;
}

function issueCategoryKeyForRule(ruleId) {
  const prefix = String(ruleId || "").split("-")[0];
  return ISSUE_CATEGORY_CONFIG[prefix] ? prefix : "IO";
}

function issueCategoryKeyForDimension(dimensionName) {
  return DIMENSION_CATEGORY_KEYS[displayDimensionName(dimensionName)] || "IO";
}

function issueCategoryMetaForDimension(dimensionName) {
  return ISSUE_CATEGORY_CONFIG[issueCategoryKeyForDimension(dimensionName)] || ISSUE_CATEGORY_CONFIG.IO;
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
    [INFORMATION_OVERLOAD_NAME]: {
      issue: "Too many competing elements appear at once.",
      impact: "Users may struggle to identify the primary reading path quickly.",
      fix: "Reduce first-screen focal points and group secondary content.",
    },
    Readability: {
      issue: "Sentence structure, wording, or chunking are increasing reading effort.",
      impact: "Users may need to reread text, decode complex wording, or hold too many instruction details in memory.",
      fix: "Use simpler words, direct instructions, and shorter grouped chunks that are easier to scan.",
    },
    "Interaction & Distraction": {
      issue: "Motion, autoplay, or interruption layers pull attention away from the current task.",
      impact: "Users may lose concentration when overlays, sticky prompts, or moving regions interrupt the reading flow.",
      fix: "Reduce autoplay and motion, and keep popups or sticky prompts collapsed unless they are essential.",
    },
    Consistency: {
      issue: "Layout or control patterns are not consistently applied.",
      impact: "Users may spend extra effort relearning navigation patterns.",
      fix: "Reuse consistent labels, spacing, and action placement.",
    },
  };
  return tooltipMap[normalized] || {
    issue: "This dimension signals cognitive-accessibility risk patterns.",
    impact: "Users may need more effort to orient and complete key tasks.",
    fix: "Simplify structure and prioritize the main user path.",
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
      <p><strong>Issue:</strong> ${escapeHtml(target.dataset.tipIssue || "")}</p>
      <p><strong>Impact:</strong> ${escapeHtml(target.dataset.tipImpact || "")}</p>
      <p><strong>Fix:</strong> ${escapeHtml(target.dataset.tipFix || "")}</p>
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

function focusIssueCard(dimensionName, ruleId) {
  focusExplanationDimension(dimensionName);
  const issueSelector = [
    `.issue-summary-card[data-highlight-dimension="${CSS.escape(dimensionName)}"]`,
    `[data-highlight-issue="${CSS.escape(ruleId)}"]`,
  ].join("");
  const card = document.querySelector(issueSelector);
  card?.scrollIntoView({ block: "center", behavior: "smooth" });
}

const DIMENSION_BARRIER_COPY = {
  [INFORMATION_OVERLOAD_NAME]: "The page is asking users to process too much at once, which makes the main reading path and task harder to identify.",
  [LEGACY_INFORMATION_OVERLOAD_NAME]: "The page is asking users to process too much at once, which makes the main reading path and task harder to identify.",
  Readability: "Sentence length, wording, instruction complexity, or missing chunking are increasing reading effort and making the main message harder to process.",
  "Interaction & Distraction": "Motion, autoplay, or interruption layers are shifting attention away from the current reading or task path.",
  Consistency: "Structural inconsistency is increasing wayfinding effort and making the page flow harder to predict.",
};

function totalIssueCount(result) {
  return (result?.dimensions || []).reduce(
    (count, dimension) => count + (dimension.issues?.length || 0),
    0,
  );
}

function issueEvidenceNumber(issue, key) {
  const value = Number(issue?.evidence?.[key]);
  return Number.isFinite(value) ? value : 0;
}

function issuePriority(issue, dimensionName = "") {
  if (isInformationOverloadDimension(dimensionName)) {
    return (
      (issue?.evidence?.blocks_primary_task ? 400 : 0)
      + (issueEvidenceNumber(issue, "confusion_distraction_level") * 100)
      + (issueEvidenceNumber(issue, "cumulative_load_level") * 10)
      + (issue?.penalty || 0)
    );
  }
  return (SEVERITY_RANK[issue?.severity] || 0) * 100 + (issue?.penalty || 0);
}

function primaryIssueForDimension(dimension) {
  return [...(dimension?.issues || [])].sort(
    (a, b) => issuePriority(b, dimension?.dimension) - issuePriority(a, dimension?.dimension),
  )[0] || null;
}

function dimensionPriorityScore(dimension) {
  const primaryIssue = primaryIssueForDimension(dimension);
  const unresolvedWeight = Math.max(0, 100 - (dimension?.score || 100)) * 100;
  return unresolvedWeight
    + issuePriority(primaryIssue, dimension?.dimension)
    + ((dimension?.issues?.length || 0) * 5);
}

function priorityDimension(result) {
  return [...(result?.dimensions || [])]
    .filter((dimension) => (dimension.issues?.length || 0) > 0)
    .sort((a, b) => {
      return dimensionPriorityScore(b) - dimensionPriorityScore(a);
    })[0] || null;
}

function firstSentence(text) {
  const value = String(text || "").trim();
  const match = value.match(/^(.+?[.!?])\s/);
  return match ? match[1] : value;
}

function uniqueSuggestions(issues) {
  const seen = new Set();
  return (issues || [])
    .map((issue) => issue.suggestion)
    .filter(Boolean)
    .filter((suggestion) => {
      const key = suggestion.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

function issueImpactLabel(issue, dimensionName) {
  if (!isInformationOverloadDimension(dimensionName)) {
    return issue?.severity ? `${issue.severity} issue` : "Priority issue";
  }
  const score = issuePriority(issue, dimensionName);
  if (score >= 700) return "High mental effort";
  if (score >= 450) return "Moderate mental effort";
  return "Supportive refinement";
}

function fixPriorityBand(issue, dimensionName) {
  if (!isInformationOverloadDimension(dimensionName)) {
    if (issue?.severity === "critical") return "Fix first";
    if (issue?.severity === "major") return "Fix next";
    return "Polish later";
  }

  const blocksPrimaryTask = Boolean(issue?.evidence?.blocks_primary_task);
  const confusionLevel = issueEvidenceNumber(issue, "confusion_distraction_level");
  const cumulativeLevel = issueEvidenceNumber(issue, "cumulative_load_level");

  if (blocksPrimaryTask && confusionLevel >= 3) {
    return "Reduce first";
  }
  if (confusionLevel >= 2 || cumulativeLevel >= 3) {
    return "Improve next";
  }
  return "Polish later";
}

function fixPriorityReason(issue, dimensionName) {
  if (!isInformationOverloadDimension(dimensionName)) {
    return "This issue should be prioritised based on how severe the current rule violation is.";
  }

  const blocksPrimaryTask = Boolean(issue?.evidence?.blocks_primary_task);
  const confusionLevel = issueEvidenceNumber(issue, "confusion_distraction_level");
  const cumulativeLevel = issueEvidenceNumber(issue, "cumulative_load_level");

  if (blocksPrimaryTask && confusionLevel >= 3) {
    return "This pattern can directly block users from locating the main reading path or the next obvious step.";
  }
  if (confusionLevel >= 2 || cumulativeLevel >= 3) {
    return "This pattern is likely to add repeated comparison, filtering, or distraction while users try to read and decide what matters.";
  }
  return "This pattern still contributes to overload, but it is less likely to be the main blocker on the current page.";
}

function affectedUsersCopy(issue, dimensionName) {
  if (issue?.evidence?.affected_users) {
    return issue.evidence.affected_users;
  }
  if (isInformationOverloadDimension(dimensionName)) {
    return "People with reading difficulties or dyslexia may need clearer chunking, calmer layouts, and a more obvious reading path.";
  }
  return "Users with cognitive or communication needs may need clearer guidance and lower mental effort.";
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

function userSpecificRecommendations(issue, dimensionName) {
  const suggestion = conciseText(issue?.suggestion, "Review this issue and simplify the interaction.", 180);
  const category = issueCategoryKeyForDimension(dimensionName);
  const recommendations = {
    ADHD: "Reduce interruptions, competing actions, and unexpected changes so attention can stay on the current task.",
    Dyslexia: "Use short, direct wording and preserve a clear reading path so users do not need to reread or relocate content.",
    Autism: "Keep structure and interaction cues predictable, and avoid sudden overlays or unclear state changes.",
  };

  if (category === "RD") {
    recommendations.Dyslexia = suggestion;
  } else if (category === "ID") {
    recommendations.ADHD = suggestion;
    recommendations.Autism = "Avoid sudden or automatic interruptions and make the interaction user-triggered where possible.";
  } else if (category === "CS") {
    recommendations.Autism = suggestion;
  } else {
    recommendations.ADHD = suggestion;
    recommendations.Dyslexia = "Reduce competing content and make the primary reading path visually obvious.";
  }

  return recommendations;
}

function frameworkMappingCopy(ruleId) {
  return RULE_FRAMEWORK_MAP[ruleId] || {
    coga: "COGA: reduce cognitive load in task flow",
    iso: "ISO 9241-11: effectiveness, efficiency, satisfaction",
    wcag: "WCAG: understandable and predictable interactions",
  };
}

function beneficiaryTags(ruleId, dimensionName) {
  const prefix = String(ruleId || "").split("-")[0] || "";
  if (RULE_BENEFICIARY_TAGS[prefix]) {
    return RULE_BENEFICIARY_TAGS[prefix];
  }
  if (dimensionName === "Readability") return RULE_BENEFICIARY_TAGS.RD;
  if (dimensionName === "Interaction & Distraction") return RULE_BENEFICIARY_TAGS.ID;
  if (dimensionName === "Consistency") return RULE_BENEFICIARY_TAGS.CS;
  return RULE_BENEFICIARY_TAGS.IO;
}

function comparisonRow(label, currentScore, previousScore, className = "") {
  const { direction, label: deltaLabel } = deltaMeta(currentScore, previousScore);
  const previousWidth = Math.max(0, Math.min(100, previousScore));
  const currentWidth = Math.max(0, Math.min(100, currentScore));

  return `
    <article class="comparison-item ${className}">
      <div class="comparison-topline">
        <strong>${escapeHtml(label)}</strong>
        <span class="comparison-delta ${direction}">${deltaLabel}</span>
      </div>
      <div class="comparison-values">
        <span>Previous ${previousScore}</span>
        <span>Current ${currentScore}</span>
      </div>
      <div class="comparison-chart">
        <div class="comparison-track previous">
          <div class="comparison-fill previous" style="width:${previousWidth}%"></div>
        </div>
        <div class="comparison-track current">
          <div class="comparison-fill current" style="width:${currentWidth}%"></div>
        </div>
      </div>
    </article>
  `;
}

function renderComparison(currentResult, previousResult, previousSourceName) {
  state.previousResult = previousResult || null;
  state.previousSourceName = previousSourceName || "";
  state.rightPanelMode = "summary";
  const comparisonList = document.getElementById("comparisonList");
  const comparisonMeta = document.getElementById("comparisonMeta");
  const comparisonSummary = document.getElementById("comparisonSummary");
  if (!comparisonList || !comparisonMeta || !comparisonSummary) {
    return;
  }

  const priority = priorityDimension(currentResult);
  const currentIssues = totalIssueCount(currentResult);
  const primaryIssue = primaryIssueForDimension(priority);
  const topCategory = priority ? displayIssueCategoryName(priority.dimension) : "";
  const lowestDimension = [...(currentResult?.dimensions || [])].sort((a, b) => (a.score || 0) - (b.score || 0))[0];
  const activeCategoryCount = (currentResult?.dimensions || []).filter((dimension) => (
    (dimension.issues?.length || 0) > 0
  )).length;
  const topIssueLabel = primaryIssue?.title || "No active issue";
  const topIssueReason = primaryIssue?.description
    ? firstSentence(primaryIssue.description)
    : "No triggered issue needs immediate attention in the current rule set.";
  const topIssueAction = priority && primaryIssue
    ? `
      <button
        class="open-top-issue-button"
        type="button"
        data-open-top-issue="${escapeHtml(primaryIssue.rule_id)}"
        data-open-top-dimension="${escapeHtml(priority.dimension)}"
      >Open top issue</button>
    `
    : "";

  comparisonMeta.textContent = "Summary";
  comparisonSummary.className = "comparison-summary priority issue-workspace-summary";
  comparisonSummary.innerHTML = `
    <span class="summary-kicker">Start here</span>
    <strong>Start with the highest-impact issue</strong>
    <span>Use the issue cards on the left to locate the problem on the page, then open the fix guidance when you are ready to redesign it.</span>
  `;
  comparisonList.className = "comparison-list priority-evidence-list issue-workspace-start";
  comparisonList.innerHTML = `
    <article class="priority-card summary-priority-card">
      <span class="priority-eyebrow">Top priority</span>
      <h3>${escapeHtml(topIssueLabel)}</h3>
      ${topCategory ? `<p class="summary-muted">${escapeHtml(topCategory)}</p>` : ""}
      <p>${escapeHtml(topIssueReason)}</p>
      ${topIssueAction}
    </article>

    <article class="priority-card summary-next-steps">
      <span class="priority-eyebrow">Next steps</span>
      <ol class="summary-step-list">
        <li><strong>Open</strong> the matching issue card on the left.</li>
        <li><strong>Show on page</strong> to see where the problem appears.</li>
        <li><strong>Fix guidance</strong> to read the evidence and redesign advice.</li>
      </ol>
    </article>

    <article class="summary-stat-grid" aria-label="Analysis snapshot">
      <div class="summary-stat-card">
        <span>Total issues</span>
        <strong>${currentIssues}</strong>
      </div>
      <div class="summary-stat-card">
        <span>Active categories</span>
        <strong>${activeCategoryCount}</strong>
      </div>
      <div class="summary-stat-card">
        <span>Lowest score</span>
        <strong>${lowestDimension ? `${lowestDimension.score}` : "-"}</strong>
        <small>${escapeHtml(lowestDimension ? displayIssueCategoryName(lowestDimension.dimension) : "No score")}</small>
      </div>
    </article>
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
  state.selectedIssueId = issueId;
  updateActiveHighlightButtons();
  return selected;
}

function selectedIssueRecord() {
  return findIssueById(state.selectedIssueId);
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
    firstFix: issue?.suggestion || "Review this issue and simplify the interaction.",
    evidence: detectedEvidenceCopy(issue),
    whyItMatters: issue?.description || "This pattern can increase mental effort and make the page harder to use.",
    userRecommendations: userSpecificRecommendations(issue, dimensionName),
    standards: [standards.wcag, standards.coga, standards.iso],
    highlightTargets: issue?.locations || [],
  };
}

function updatePreviewIssueHeader() {
  const titleNode = document.getElementById("previewIssueTitle");
  const detailsButton = document.getElementById("previewDetailsButton");
  const selected = selectedIssueRecord();
  if (!titleNode || !detailsButton) {
    return;
  }

  if (!selected) {
    titleNode.textContent = "No issue selected";
    detailsButton.hidden = true;
    setWebsiteStatus("Select an issue and choose Show on page to highlight it in the preview.");
    return;
  }

  const model = issueDisplayModel(selected.issue, selected.dimension.dimension);
  titleNode.textContent = `Highlighted issue: ${model.issueTitle}`;
  detailsButton.hidden = false;
}

function issueHighlightElements(frameDoc, issue, dimensionName) {
  const locationElements = (issue.locations || []).flatMap((location) => (
    findElementsForLocation(frameDoc, location)
  ));
  if (locationElements.length) {
    return { elements: locationElements, exact: true };
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

  const { elements, exact } = issueHighlightElements(frameDoc, issue, dimensionName);
  const highlighted = applyHighlights(elements, config.color, "Issue highlight");
  const firstElement = highlighted.values().next().value;
  firstElement?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });

  if (highlighted.size) {
    const fallbackNotice = exact ? "" : " No exact page element is linked to this issue yet; related areas are highlighted instead.";
    setWebsiteStatus(`${highlighted.size} area${highlighted.size === 1 ? "" : "s"} highlighted for ${issue.title || "this issue"}.${fallbackNotice}`);
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

function renderIssueDetailPanel(dimensionName, ruleId) {
  const comparisonList = document.getElementById("comparisonList");
  const comparisonMeta = document.getElementById("comparisonMeta");
  const comparisonSummary = document.getElementById("comparisonSummary");
  if (!comparisonList || !comparisonMeta || !comparisonSummary) {
    return;
  }

  const selected = selectIssue(dimensionName, ruleId);
  if (!selected) {
    return;
  }

  const { dimension, issue } = selected;
  const model = issueDisplayModel(issue, dimension.dimension);
  state.rightPanelMode = "detail";
  setWorkspaceMode("explanation");
  updateActiveHighlightButtons();

  comparisonMeta.textContent = "Issue detail";
  comparisonSummary.className = "comparison-summary priority issue-detail-summary";
  comparisonSummary.innerHTML = `
    <div class="issue-detail-heading">
      <button class="back-to-summary-button" type="button" data-back-to-summary>Back to Summary</button>
      <span>${escapeHtml(model.issueCategory)}</span>
      <button
        class="view-on-page-button compact"
        type="button"
        data-view-on-page="${escapeHtml(issue.rule_id)}"
        data-view-dimension="${escapeHtml(dimension.dimension)}"
      >View on page</button>
    </div>
    <strong>Issue Detail: ${escapeHtml(model.issueTitle)}</strong>
    <span>${escapeHtml(conciseText(model.cognitiveImpact, "This issue may increase cognitive load for users.", 220))}</span>
    <div class="recommended-fix-callout">
      <span>Recommended first change</span>
      <p>${escapeHtml(model.firstFix)}</p>
    </div>
  `;

  comparisonList.className = "comparison-list issue-detail-panel";
  comparisonList.innerHTML = `
    <article class="priority-card">
      <span class="priority-eyebrow">Evidence</span>
      <p>${escapeHtml(model.evidence)}</p>
      <span class="supporting-label">Why it matters</span>
      <p>${escapeHtml(model.whyItMatters)}</p>
    </article>

    <article class="priority-card">
      <span class="priority-eyebrow">Affected user groups</span>
      <p>${escapeHtml(model.affectedUsers.join(", "))}</p>
    </article>

    <article class="priority-card">
      <span class="priority-eyebrow">User-specific recommendations</span>
      <div class="recommendation-stack">
        <p><strong>ADHD users:</strong> ${escapeHtml(model.userRecommendations.ADHD)}</p>
        <p><strong>Dyslexia users:</strong> ${escapeHtml(model.userRecommendations.Dyslexia)}</p>
        <p><strong>Autistic users:</strong> ${escapeHtml(model.userRecommendations.Autism)}</p>
      </div>
    </article>

    <details class="supporting-standards">
      <summary>Standards / framework mapping</summary>
      <ul class="priority-evidence">
        ${model.standards.map((standard) => `<li>${escapeHtml(standard)}</li>`).join("")}
      </ul>
    </details>
  `;
}

function backToSummaryPanel() {
  state.selectedIssueId = "";
  state.rightPanelMode = "summary";
  state.activeHighlightIssueId = "";
  state.activeHighlightDimension = "";
  clearWebsiteHighlights();
  updateActiveHighlightButtons();
  setWorkspaceMode("explanation");
  renderComparison(state.currentResult, state.previousResult, state.previousSourceName);
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
  highlightSelectedIssueInPreview();
}

function issueSummaryCardMarkup(issue, dimensionName, issueIndex) {
  const issueId = issueDomId(dimensionName, issue.rule_id);
  const isSelected = issueId === state.selectedIssueId;
  const isPreviewActive = isSelected && state.rightPanelMode === "preview";
  const isDetailActive = isSelected && state.rightPanelMode === "detail";
  const selectedClass = isSelected ? " is-selected is-active" : "";
  const affectedGroups = issueAffectedGroups(issue, dimensionName).join(", ");
  const firstFix = conciseText(issue.suggestion, "Review this issue and simplify the interaction.", 135);

  return `
    <article
      class="issue-highlight-button issue-summary-card${selectedClass}"
      data-highlight-issue="${escapeHtml(issue.rule_id)}"
      data-highlight-dimension="${escapeHtml(dimensionName)}"
    >
      <div class="issue-summary-topline">
        <span class="issue-highlight-rule">Issue ${issueIndex + 1}</span>
      </div>
      <strong class="issue-summary-title">${escapeHtml(issue.title || "Review this issue")}</strong>
      <div class="issue-summary-row">
        <span class="issue-highlight-label">Likely affected users</span>
        <span class="issue-highlight-copy">${escapeHtml(affectedGroups)}</span>
      </div>
      <div class="issue-summary-row">
        <span class="issue-highlight-label">First fix</span>
        <span class="issue-highlight-copy">${escapeHtml(firstFix)}</span>
      </div>
      <div class="issue-summary-actions">
        <button
          class="view-on-page-button${isPreviewActive ? " is-active" : ""}"
          type="button"
          data-view-on-page="${escapeHtml(issue.rule_id)}"
          data-view-dimension="${escapeHtml(dimensionName)}"
          aria-label="Show this issue on the analysed page"
          aria-pressed="${isPreviewActive ? "true" : "false"}"
        >Show on page</button>
        <button
          class="view-details-button${isDetailActive ? " is-active" : ""}"
          type="button"
          data-view-issue="${escapeHtml(issue.rule_id)}"
          data-view-dimension="${escapeHtml(dimensionName)}"
          aria-label="View fix guidance and recommendations for this issue"
          aria-pressed="${isDetailActive ? "true" : "false"}"
        >Fix guidance</button>
      </div>
    </article>
  `;
}

function renderExplanation(result) {
  const explanationContent = document.getElementById("explanationContent");
  if (!explanationContent) {
    return;
  }

  const explanationOrder = [
    INFORMATION_OVERLOAD_NAME,
    "Readability",
    "Interaction & Distraction",
    "Consistency",
  ];
  const orderIndex = (dimensionName) => {
    const index = explanationOrder.indexOf(displayDimensionName(dimensionName));
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const orderedDimensions = [...result.dimensions].sort((left, right) => {
    const orderDelta = orderIndex(left.dimension) - orderIndex(right.dimension);
    if (orderDelta !== 0) {
      return orderDelta;
    }
    return displayDimensionName(left.dimension).localeCompare(displayDimensionName(right.dimension));
  });

  const blocks = orderedDimensions.map((dimension) => {
    const issueCount = dimension.issues.length;
    const displayName = displayDimensionName(dimension.dimension);
    const issueCategoryName = displayIssueCategoryName(dimension.dimension);
    const cognitiveDimension = cognitiveDimensionLabel(dimension.dimension);
    const summary = issueCount === 0
      ? "No triggered issues in this category."
      : `${issueCount} issue${issueCount === 1 ? "" : "s"} found · ${cognitiveDimension}`;

    const issues = issueCount
      ? `<div class="issue-highlight-list">${dimension.issues.map((issue, issueIndex) => (
          issueSummaryCardMarkup(issue, dimension.dimension, issueIndex)
        )).join("")}</div>`
      : "";

    return `
      <details class="explanation-block explanation-accordion" data-explanation-dimension="${escapeHtml(displayName)}">
        <summary class="explanation-accordion-summary">
          <span class="explanation-accordion-title">${escapeHtml(issueCategoryName)}</span>
          <span class="explanation-accordion-meta">
            <span class="explanation-accordion-issue-count">${issueCount}</span>
            <span class="explanation-accordion-chevron" aria-hidden="true">▾</span>
          </span>
        </summary>
        <div class="explanation-accordion-content">
          <p class="category-helper">${escapeHtml(summary)}</p>
          ${issues}
        </div>
      </details>
    `;
  });

  explanationContent.className = "pane-scroll rich-text";
  explanationContent.innerHTML = blocks.join("");
  setActiveDimensionBar("");
}

function isProbablyUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
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
  const toggle = document.getElementById("websiteViewToggle");

  if (!explanationView || !websiteView || !toggle) {
    return;
  }

  const isWebsite = mode === "website";
  explanationView.hidden = isWebsite;
  websiteView.hidden = !isWebsite;
  explanationView.classList.toggle("is-active", !isWebsite);
  websiteView.classList.toggle("is-active", isWebsite);
  toggle.textContent = isWebsite
    ? (state.selectedIssueId ? "Back to issue details" : "Back to summary")
    : (state.selectedIssueId ? "View selected issue on page" : "Click to view the website");

  if (isWebsite) {
    updatePreviewIssueHeader();
    loadWebsitePreview();
  }
}

function getPreviewUrl() {
  if (isProbablyUrl(state.sourceUrl)) {
    return state.sourceUrl;
  }
  if (isProbablyUrl(state.sourceName)) {
    return state.sourceName;
  }
  const runSourceName = state.currentPayload?.run?.source_name;
  return isProbablyUrl(runSourceName) ? runSourceName : "";
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

  const previewUrl = getPreviewUrl();
  if (previewUrl) {
    const proxiedUrl = `${API_BASE}/eye/proxy?url=${encodeURIComponent(previewUrl)}`;
    if (frame.dataset.previewUrl !== proxiedUrl) {
      frame.removeAttribute("srcdoc");
      frame.src = proxiedUrl;
      frame.dataset.previewUrl = proxiedUrl;
      setWebsiteStatus("Loading proxied website preview...");
    }
    return;
  }

  if (state.currentHtml) {
    if (frame.dataset.previewHtml !== state.currentHtml || frame.dataset.previewGuardVersion !== "3") {
      frame.removeAttribute("src");
      frame.srcdoc = buildPreviewHtml(state.currentHtml);
      frame.dataset.previewHtml = state.currentHtml;
      frame.dataset.previewGuardVersion = "3";
      setWebsiteStatus("Loaded uploaded HTML preview. Choose a dimension to highlight related areas.");
    }
    return;
  }

  setWebsiteStatus("No website preview is available for this analysis.", true);
}

function startBackgroundRenderedAnalysis() {
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
  if (!value || value === "script" || value.includes(" ")) {
    return "";
  }
  return value
    .replace(/#([A-Za-z0-9_-]+)/g, (_match, id) => `#${cssEscape(id)}`)
    .replace(/\.([A-Za-z0-9_-]+)/g, (_match, className) => `.${cssEscape(className)}`);
}

function collectTextBlocks(doc) {
  return Array.from(doc.querySelectorAll("p, li, article, section, blockquote, td, th"))
    .filter((element) => normalizeInlineText(element.textContent).length >= 20);
}

function countMeaningfulElements(doc) {
  if (!doc?.body) {
    return 0;
  }
  return doc.body.querySelectorAll("button, a, input, textarea, select, section, article, nav, aside, dialog, [role='dialog'], [role='button'], [class*='card' i], [class*='modal' i], [class*='popup' i]").length;
}

function isLegacyCtaCompetitionIssue(issue) {
  if (!issue || issue.rule_id !== "ID-3") {
    return false;
  }

  const text = normalizeInlineText([
    issue.title,
    issue.description,
    issue.suggestion,
  ].filter(Boolean).join(" "));

  return [
    "primary-looking actions",
    "decision hierarchy",
    "what to do next",
    "next action",
    "multiple buttons",
    "competing ctas",
    "competing actions",
    "primary action buttons",
  ].some((keyword) => text.includes(keyword));
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

function findElementsForLocation(doc, location) {
  if (!location || typeof location !== "object") {
    return [];
  }

  if (location.selector) {
    try {
      return Array.from(doc.querySelectorAll(location.selector));
    } catch (error) {
      return [];
    }
  }

  const summarySelector = summaryToSelector(location.summary || location.region);
  if (summarySelector) {
    try {
      const matched = Array.from(doc.querySelectorAll(summarySelector));
      if (matched.length) {
        return matched;
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
    if (matched.length) {
      return matched;
    }
  }

  if (location.preview) {
    const matched = findByText(doc, location.tag, location.preview);
    if (matched.length) {
      return matched;
    }
  }

  if (location.sentence_preview) {
    const matched = findByText(doc, location.tag, location.sentence_preview);
    if (matched.length) {
      return matched;
    }
  }

  if (location.label || location.summary) {
    const text = location.label || location.summary;
    const matched = findByText(doc, location.tag, text);
    if (matched.length) {
      return matched;
    }
  }

  return [];
}

function fallbackSelectorsForIssue(issue, dimensionName) {
  const ruleId = issue?.rule_id || "";
  if (ruleId === "IO-1") {
    return ["main > *", "header > *", "section", "article", "nav", "button", "a", "img", "h1", "h2"];
  }
  if (ruleId === "IO-2") {
    return ["section", "article", "ul", "ol", ".card", "[class*='card' i]", "[class*='grid' i]"];
  }
  if (ruleId === "IO-3") {
    return ["aside", "[class*='sidebar' i]", "[class*='banner' i]", "[class*='promo' i]", "[class*='support' i]"];
  }
  if (ruleId === "IO-4") {
    return ["button", "a", "[role='button']", "[class*='cta' i]", "[class*='primary' i]", "[class*='hero' i]", "[class*='btn' i]"];
  }
  if (ruleId === "IO-5") {
    return ["h1", "h2", "button", "a", "[role='button']", "main", "header"];
  }
  if (ruleId === "RD-1" || ruleId === "RD-2" || ruleId === "RD-4" || ruleId === "RD-5" || ruleId === "RD-6") {
    return ["p", "li", "article", "section", "label", "legend", "small"];
  }
  if (ruleId === "RD-3") {
    return ["button", "a", "[role='button']", "input[type='submit']", "input[type='button']", "input[type='reset']"];
  }
  if (ruleId === "ID-1") {
    return ["video[autoplay]", "audio[autoplay]", "iframe"];
  }
  if (ruleId === "ID-2") {
    return ["[style*='animation' i]", "[style*='transition' i]", "marquee", "video", "iframe", "[class*='animate' i]", "[class*='motion' i]"];
  }
  if (ruleId === "ID-3") {
    if (isLegacyCtaCompetitionIssue(issue)) {
      return ["button", "a", "[role='button']", "input[type='submit']", "input[type='button']", "[class*='cta' i]", "[class*='primary' i]", "[class*='btn' i]", "[class*='action' i]"];
    }
    return ["dialog", "[role='dialog']", "[role='alertdialog']", "[aria-modal='true']", "[aria-live]", "[class*='modal' i]", "[class*='popup' i]", "[class*='overlay' i]", "[class*='toast' i]", "[class*='notification' i]", "[class*='sticky' i]", "[class*='chat' i]", "[class*='cookie' i]", "[class*='consent' i]"];
  }
  if (ruleId === "CS-1") {
    return ["h1", "h2", "h3", "h4", "h5", "h6"];
  }
  if (ruleId === "CS-2") {
    return ["nav", "header", "main", "form", "[class*='step' i]", "[class*='breadcrumb' i]"];
  }
  return HIGHLIGHT_CONFIG[dimensionName]?.selectors || [];
}

function applyHighlights(elements, color, label) {
  const highlighted = new Set();
  elements.forEach((element) => {
    if (!element || element.nodeType !== 1 || highlighted.size >= 30 || highlighted.has(element)) {
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
    element.setAttribute("data-cognilens-highlight", label);
    element.style.setProperty("--cognilens-highlight-color", color);
    highlighted.add(element);
  });
  return highlighted;
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

  document.querySelectorAll("[data-view-on-page]").forEach((button) => {
    const issueId = issueDomId(button.dataset.viewDimension, button.dataset.viewOnPage);
    const isActive = issueId === state.selectedIssueId && state.rightPanelMode === "preview";
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  document.querySelectorAll("[data-view-issue]").forEach((button) => {
    const issueId = issueDomId(button.dataset.viewDimension, button.dataset.viewIssue);
    const isActive = issueId === state.selectedIssueId && state.rightPanelMode === "detail";
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function highlightDimension(dimensionName) {
  const issueCategoryName = displayIssueCategoryName(dimensionName);
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
  const frameDoc = getPreviewDocument();

  updateActiveHighlightButtons();

  if (state.workspaceMode !== "website") {
    setWorkspaceMode("website");
  }

  if (!frameDoc || !config) {
    setWebsiteStatus("The website preview is still loading. Try again in a moment.", true);
    return;
  }

  injectHighlightStyles(frameDoc);
  clearWebsiteHighlights(frameDoc);

  if (!dimension?.issues?.length) {
    setWebsiteStatus(`${issueCategoryName} has no triggered issues in this analysis.`);
    return;
  }

  const candidateElements = [];
  config.selectors.forEach((selector) => {
    frameDoc.querySelectorAll(selector).forEach((element) => {
      candidateElements.push(element);
    });
  });
  const highlighted = applyHighlights(candidateElements, config.color, issueCategoryName);

  const firstElement = highlighted.values().next().value;
  firstElement?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });

  if (highlighted.size) {
    setWebsiteStatus(`${highlighted.size} related area${highlighted.size === 1 ? "" : "s"} highlighted for ${issueCategoryName}.`);
  } else {
    setWebsiteStatus(`No directly highlightable elements were found for ${issueCategoryName}; this issue may describe a missing or page-level pattern.`, true);
  }
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

  if (state.workspaceMode !== "website") {
    setWorkspaceMode("website");
  }

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

  const { elements, exact } = issueHighlightElements(frameDoc, issue, dimensionName);

  const highlighted = applyHighlights(elements, config.color, "Issue highlight");
  const firstElement = highlighted.values().next().value;
  firstElement?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });

  if (highlighted.size) {
    const fallbackNotice = exact ? "" : " No exact page element is linked to this issue yet; related areas are highlighted instead.";
    setWebsiteStatus(`${highlighted.size} area${highlighted.size === 1 ? "" : "s"} highlighted for ${issueLabel}.${fallbackNotice}`);
  } else {
    setWebsiteStatus("No exact page element is linked to this issue yet.", true);
  }
}

function renderPrintSummary(result) {
  const overallNode = document.getElementById("printOverallScore");
  const sourceNode = document.getElementById("printSourceName");
  const summaryNode = document.getElementById("printSummaryText");
  const dimensionNode = document.getElementById("printDimensionSummary");

  if (!overallNode || !sourceNode || !summaryNode || !dimensionNode) {
    return;
  }

  overallNode.textContent = String(result.overall_score);
  sourceNode.textContent = state.sourceName || "Uploaded file";
  summaryNode.textContent = [
    `Overall score ${result.overall_score}.`,
    `Lowest dimension ${result.min_dimension_score}.`,
    `${result.dimensions.reduce((count, dimension) => count + dimension.issues.length, 0)} issues detected in this report.`,
  ].filter(Boolean).join(" ");

  dimensionNode.innerHTML = DIMENSION_CONFIG.map(({ name }) => {
    const dimension = findDimension(result, name);
    const score = dimension ? dimension.score : 0;
    return `
      <article class="print-dimension-card">
        <span>${escapeHtml(displayIssueCategoryName(name))}</span>
        <strong>${score}</strong>
      </article>
    `;
  }).join("");
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
        severity: issue.severity,
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
  renderPrintSummary(result);
  renderExplanation(result);
  renderAssistantMessages();
}

function buildRenderedDomAnalysisKey(doc) {
  if (!doc?.documentElement) {
    return "";
  }
  const title = String(doc.title || "").trim();
  const textSample = normalizeInlineText(doc.body?.innerText || "").slice(0, 400);
  const elementCount = countMeaningfulElements(doc);
  return `${getPreviewUrl()}::${title}::${elementCount}::${textSample}`;
}

function shouldAnalyzeRenderedPreview(doc) {
  if (!isProbablyUrl(state.sourceUrl) || !doc?.documentElement || state.renderedDomAnalysisPending) {
    return false;
  }
  const html = doc.documentElement.outerHTML || "";
  if (!html.trim()) {
    return false;
  }
  const key = buildRenderedDomAnalysisKey(doc);
  if (!key || key === state.renderedDomAnalysisKey) {
    return false;
  }
  return true;
}

function saveTransientDashboardState(payload, html) {
  const existingSession = loadDashboardSession();
  if (!existingSession?.current) {
    return;
  }
  saveDashboardSession({
    ...existingSession,
    current: {
      ...existingSession.current,
      payload,
      html,
      savedAt: new Date().toISOString(),
    },
    html,
    sourceName: state.sourceName,
    sourceUrl: state.sourceUrl,
    savedAt: new Date().toISOString(),
  });
}

async function analyzeRenderedPreviewDocument(doc) {
  if (!shouldAnalyzeRenderedPreview(doc)) {
    return;
  }

  const renderedHtml = doc.documentElement.outerHTML || "";
  const analysisKey = buildRenderedDomAnalysisKey(doc);
  if (!renderedHtml.trim() || !analysisKey) {
    return;
  }

  state.renderedDomAnalysisPending = true;
  setWebsiteStatus("Preview rendered. Re-analyzing the live DOM for a more accurate localhost result...");

  try {
    const renderedPayload = await analyzeHtmlText(
      renderedHtml,
      state.sourceUrl || state.sourceName || "rendered-preview.html",
      { persistResult: false },
    );
    const mergedPayload = {
      ...(state.currentPayload || {}),
      ...renderedPayload,
      run: state.currentPayload?.run || renderedPayload.run,
      resource_bundle: state.currentPayload?.resource_bundle || renderedPayload.resource_bundle,
      html_content: renderedHtml,
    };
    try {
      mergedPayload.visual_complexity = await analyzeVisualComplexityHtml(renderedHtml);
      delete mergedPayload.visual_complexity_error;
    } catch (error) {
      mergedPayload.visual_complexity_error = error.message || String(error);
    }

    state.currentPayload = mergedPayload;
    state.renderedDomAnalysisKey = analysisKey;
    saveTransientDashboardState(mergedPayload, renderedHtml);
    renderResult(buildAnalysisView(mergedPayload), renderedHtml, { preserveSelectedIssue: true });
    updateActiveHighlightButtons();
    const selectedAfterRender = selectedIssueRecord();
    if (state.rightPanelMode === "detail" && selectedAfterRender) {
      renderIssueDetailPanel(selectedAfterRender.dimension.dimension, selectedAfterRender.issue.rule_id);
    }

    const frameDoc = getPreviewDocument();
    if (frameDoc) {
      injectHighlightStyles(frameDoc);
      clearWebsiteHighlights(frameDoc);
      if (state.rightPanelMode === "preview" && state.selectedIssueId) {
        highlightSelectedIssueInPreview();
      } else if (state.activeHighlightIssueId) {
        const [dimensionName, ruleId] = state.activeHighlightIssueId.split(":");
        highlightIssue(dimensionName, ruleId, true);
      } else if (state.activeHighlightDimension) {
        highlightDimension(state.activeHighlightDimension);
      } else {
        setWebsiteStatus("Live DOM analysis updated. Choose a dimension or issue to highlight related areas.");
      }
    }
  } catch (error) {
    state.renderedDomAnalysisKey = analysisKey;
    setWebsiteStatus(`Rendered preview analysis failed: ${error.message || String(error)}`, true);
  } finally {
    state.renderedDomAnalysisPending = false;
  }
}

function queueRenderedDomAnalysis() {
  const doc = getPreviewDocument();
  if (!shouldAnalyzeRenderedPreview(doc)) {
    return;
  }
  if (state.renderedDomAnalysisTimer) {
    window.clearTimeout(state.renderedDomAnalysisTimer);
  }
  state.renderedDomAnalysisTimer = window.setTimeout(() => {
    const latestDoc = getPreviewDocument();
    analyzeRenderedPreviewDocument(latestDoc);
  }, 900);
}

function getStoredSidebarWidth() {
  const storedWidth = Number(sessionStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
  if (!Number.isFinite(storedWidth)) {
    return DEFAULT_SIDEBAR_WIDTH;
  }
  return Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, storedWidth));
}

function setSidebarWidth(width) {
  const resolvedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width));
  document.documentElement.style.setProperty("--sidebar-width", `${resolvedWidth}px`);
  sessionStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(resolvedWidth));
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
  setSidebarWidth(getStoredSidebarWidth());
  state.sidebarCollapsed = sessionStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  applySidebarState();
  window.addEventListener("resize", applySidebarState);
}

function initSidebarResize() {
  const resizeHandle = document.getElementById("sidebarResizeHandle");
  if (!resizeHandle) {
    return;
  }

  resizeHandle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    document.body.classList.add("resizing-sidebar");
    resizeHandle.setPointerCapture?.(event.pointerId);

    const handleMove = (moveEvent) => {
      setSidebarWidth(moveEvent.clientX);
    };

    const handleUp = () => {
      document.body.classList.remove("resizing-sidebar");
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  });
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

function initPreviewMessageBridge() {
}

function bindEvents() {
  const printButton = document.getElementById("printReportBtn");
  const assistantForm = document.getElementById("assistantForm");
  const assistantInput = document.getElementById("assistantInput");
  const clearButton = document.getElementById("clearAssistantButton");
  const sidebarToggleButton = document.getElementById("sidebarToggleButton");
  const websiteViewToggle = document.getElementById("websiteViewToggle");
  const websitePreviewFrame = document.getElementById("websitePreviewFrame");
  const dimensionBars = document.getElementById("dimensionBars");
  const explanationContent = document.getElementById("explanationContent");
  initSidebarResize();
  initAssistantFloating();
  initPreviewMessageBridge();
  initDimensionInfoTooltip();

  if (printButton) {
    printButton.addEventListener("click", () => {
      window.print();
    });
  }

  if (assistantForm) {
    assistantForm.addEventListener("submit", handleAssistantSubmit);
  }

  if (assistantInput) {
    assistantInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        assistantForm?.requestSubmit();
      }
    });
  }

  if (clearButton) {
    clearButton.addEventListener("click", handleAssistantClear);
  }

  if (sidebarToggleButton) {
    sidebarToggleButton.addEventListener("click", handleSidebarToggle);
  }

  if (websiteViewToggle) {
    websiteViewToggle.addEventListener("click", () => {
      if (state.workspaceMode === "website") {
        setWorkspaceMode("explanation");
        if (state.selectedIssueId && state.rightPanelMode === "preview") {
          const selected = selectedIssueRecord();
          if (selected) {
            renderIssueDetailPanel(selected.dimension.dimension, selected.issue.rule_id);
          }
        } else {
          renderComparison(state.currentResult, state.previousResult, state.previousSourceName);
        }
        return;
      }

      state.rightPanelMode = "preview";
      setWorkspaceMode("website");
      if (state.selectedIssueId) {
        highlightSelectedIssueInPreview();
      }
    });
  }

  document.querySelectorAll("[data-highlight-dimension]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.highlightIssue) {
        highlightIssue(button.dataset.highlightDimension, button.dataset.highlightIssue);
      } else {
        highlightDimension(button.dataset.highlightDimension);
      }
    });
  });

  if (dimensionBars) {
    dimensionBars.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-highlight-dimension]");
      if (trigger) {
        highlightDimension(trigger.dataset.highlightDimension);
        focusExplanationDimension(trigger.dataset.dimensionKey || trigger.dataset.highlightDimension);
      }
    });
  }

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
    const topIssueTrigger = event.target.closest("[data-open-top-issue]");
    if (topIssueTrigger) {
      event.preventDefault();
      const dimensionName = topIssueTrigger.dataset.openTopDimension;
      const ruleId = topIssueTrigger.dataset.openTopIssue;
      focusIssueCard(dimensionName, ruleId);
      renderIssueDetailPanel(dimensionName, ruleId);
      return;
    }

    const pageTrigger = event.target.closest("[data-view-on-page]");
    if (pageTrigger) {
      event.preventDefault();
      event.stopPropagation();
      renderIssuePreviewPanel(pageTrigger.dataset.viewDimension, pageTrigger.dataset.viewOnPage);
      return;
    }

    const detailTrigger = event.target.closest("[data-view-issue]");
    if (detailTrigger) {
      event.preventDefault();
      event.stopPropagation();
      renderIssueDetailPanel(detailTrigger.dataset.viewDimension, detailTrigger.dataset.viewIssue);
      return;
    }

    const selectedDetailsTrigger = event.target.closest("[data-view-selected-details]");
    if (selectedDetailsTrigger) {
      event.preventDefault();
      const selected = selectedIssueRecord();
      if (selected) {
        renderIssueDetailPanel(selected.dimension.dimension, selected.issue.rule_id);
      }
      return;
    }

    const backTrigger = event.target.closest("[data-back-to-summary]");
    if (backTrigger) {
      event.preventDefault();
      backToSummaryPanel();
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
      injectHighlightStyles(doc);
      updatePreviewIssueHeader();
      if (state.rightPanelMode === "preview" && state.selectedIssueId) {
        highlightSelectedIssueInPreview();
      } else if (state.activeHighlightIssueId) {
        const [dimensionName, ruleId] = state.activeHighlightIssueId.split(":");
        highlightIssue(dimensionName, ruleId, true);
      } else if (state.selectedIssueId) {
        const selected = findIssueById(state.selectedIssueId);
        if (selected) {
          highlightIssueInLoadedPreview(selected.dimension.dimension, selected.issue.rule_id);
        }
      } else if (state.activeHighlightDimension) {
        highlightDimension(state.activeHighlightDimension);
      }
      queueRenderedDomAnalysis();
    });
  }
}

async function init() {
  initSidebar();
  bindEvents();

  const session = loadDashboardSession();
  const currentSession = session?.current;
  const previousSession = session?.previous;
  if (!currentSession?.payload) {
    window.location.href = "./index.html";
    return;
  }

  const currentResult = buildAnalysisView(currentSession.payload);
  const previousResult = previousSession?.payload ? buildAnalysisView(previousSession.payload) : null;
  const sourceNode = document.getElementById("dashboardSourceName");
  state.currentPayload = currentSession.payload;
  state.sourceName = currentSession.sourceName || currentSession.payload?.run?.source_name || "Uploaded file";
  state.sourceUrl = currentSession.sourceUrl || (isProbablyUrl(state.sourceName) ? state.sourceName : "");
  if (sourceNode) {
    sourceNode.textContent = state.sourceName;
  }

  renderResult(
    currentResult,
    currentSession.html || currentSession.payload.html_content || "",
  );
  renderComparison(currentResult, previousResult, previousSession?.sourceName || "");
  startBackgroundRenderedAnalysis();

  if (sessionStorage.getItem(AUTO_PRINT_STORAGE_KEY) === "true") {
    sessionStorage.removeItem(AUTO_PRINT_STORAGE_KEY);
    window.setTimeout(() => {
      window.print();
    }, 150);
  }
}

init().catch((error) => {
  document.body.innerHTML = `<pre style="padding:24px;">${escapeHtml(String(error))}</pre>`;
});
