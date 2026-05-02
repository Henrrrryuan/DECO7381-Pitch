import {
  API_BASE,
  analyzeHtmlText,
  analyzeVisualComplexityHtml,
  buildAnalysisView,
  chatWithAssistant,
  escapeHtml,
  fetchJson,
  findDimension,
  formatReportTimestamp,
  loadDashboardSession,
  saveDashboardSession,
} from "../lib/common.js";

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
  activeProfile: "Dyslexia",
};

const SIDEBAR_STORAGE_KEY = "cognilens.sidebar.collapsed";
const ASSISTANT_POSITION_STORAGE_KEY = "cognilens.assistant.position";
const AUTO_PRINT_STORAGE_KEY = "cognilens.dashboard.autoPrint";
const ANALYSIS_RETURN_URL_STORAGE_KEY = "cognilens.return.analysis-url";
const DASHBOARD_HISTORY_CONTEXT_KEY = "cognilens.dashboard.history-context";
const DASHBOARD_HISTORY_ONCE_KEY = "cognilens.dashboard.history-once";
const ASSISTANT_MARGIN = 16;

const INFORMATION_OVERLOAD_NAME = "Information Overload";
const LEGACY_INFORMATION_OVERLOAD_NAME = "Visual Complexity";
const ISSUE_CATEGORY_CONFIG = {
  IO: {
    displayName: "Information Overload Issue",
  },
  RD: {
    displayName: "Readability Issue",
  },
  ID: {
    displayName: "Interaction & Distraction Issue",
  },
  CS: {
    displayName: "Consistency & Predictability Issue",
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
    iso: "ISO 9241-11:2018 6.3.3 Human effort expended; 6.4.3 Cognitive responses",
    wcag: "WCAG SC 2.4.3 Focus Order; SC 2.4.6 Headings and Labels",
  },
  "IO-2": {
    coga: "COGA: Reduce cognitive load from dense regions",
    iso: "ISO 9241-11:2018 6.3.3 Human effort expended",
    wcag: "WCAG SC 1.3.1 Info and Relationships; SC 2.4.6 Headings and Labels",
  },
  "IO-3": {
    coga: "COGA: Minimize competing peripheral content",
    iso: "ISO 9241-11:2018 6.4.3 Cognitive responses; 6.4.4 Emotional responses",
    wcag: "WCAG SC 2.4.3 Focus Order; SC 3.2.3 Consistent Navigation",
  },
  "IO-4": {
    coga: "COGA: Make the next action obvious",
    iso: "ISO 9241-11:2018 6.2.1 Effectiveness general; 6.3.3 Human effort expended",
    wcag: "WCAG SC 3.2.4 Consistent Identification; SC 2.4.6 Headings and Labels",
  },
  "IO-5": {
    coga: "COGA: Keep a clear information hierarchy",
    iso: "ISO 9241-11:2018 6.2.2 Accuracy; 6.3.3 Human effort expended",
    wcag: "WCAG SC 1.3.1 Info and Relationships; SC 2.4.6 Headings and Labels",
  },
  "RD-1": {
    coga: "COGA: Use shorter, easier language",
    iso: "ISO 9241-11:2018 6.2.2 Accuracy",
    wcag: "WCAG SC 3.1.5 Reading Level (AAA)",
  },
  "RD-2": {
    coga: "COGA: Break content into manageable chunks",
    iso: "ISO 9241-11:2018 6.3.2 Time used; 6.3.3 Human effort expended",
    wcag: "WCAG SC 1.3.1 Info and Relationships; SC 2.4.6 Headings and Labels",
  },
  "RD-3": {
    coga: "COGA: Use clear action labels",
    iso: "ISO 9241-11:2018 6.2.2 Accuracy",
    wcag: "WCAG SC 2.4.6 Headings and Labels; SC 3.3.2 Labels or Instructions",
  },
  "RD-4": {
    coga: "COGA: Prefer familiar vocabulary",
    iso: "ISO 9241-11:2018 6.2.2 Accuracy; 6.4.3 Cognitive responses",
    wcag: "WCAG SC 3.1.3 Unusual Words; SC 3.1.5 Reading Level (AAA)",
  },
  "RD-5": {
    coga: "COGA: Keep instructions explicit and direct",
    iso: "ISO 9241-11:2018 6.2.3 Completeness",
    wcag: "WCAG SC 3.3.2 Labels or Instructions; SC 3.3.5 Help (AAA)",
  },
  "RD-6": {
    coga: "COGA: Support scanning with chunking",
    iso: "ISO 9241-11:2018 6.3.3 Human effort expended",
    wcag: "WCAG SC 1.3.1 Info and Relationships; SC 2.4.6 Headings and Labels",
  },
  "ID-1": {
    coga: "COGA: Avoid unexpected autoplay triggers",
    iso: "ISO 9241-11:2018 6.4.2 Physical responses; 6.4.4 Emotional responses",
    wcag: "WCAG SC 2.2.2 Pause, Stop, Hide; SC 1.4.2 Audio Control",
  },
  "ID-2": {
    coga: "COGA: Reduce distracting motion",
    iso: "ISO 9241-11:2018 6.4.2 Physical responses; 6.4.3 Cognitive responses",
    wcag: "WCAG SC 2.3.3 Animation from Interactions; SC 2.2.2 Pause, Stop, Hide",
  },
  "ID-3": {
    coga: "COGA: Avoid interruptive overlays",
    iso: "ISO 9241-11:2018 6.2.3 Completeness; 6.4.4 Emotional responses",
    wcag: "WCAG SC 3.2.1 On Focus; SC 3.2.2 On Input",
  },
  "CS-1": {
    coga: "COGA: Keep structure predictable",
    iso: "ISO 9241-11:2018 6.3.3 Human effort expended",
    wcag: "WCAG SC 1.3.1 Info and Relationships; SC 2.4.6 Headings and Labels",
  },
  "CS-2": {
    coga: "COGA: Keep users oriented in multi-step tasks",
    iso: "ISO 9241-11:2018 6.2.2 Accuracy",
    wcag: "WCAG SC 2.4.8 Location (AAA)",
  },
  "CS-3": {
    coga: "COGA: Keep users oriented during multi-step processes",
    iso: "ISO 9241-11:2018 6.2.3 Completeness; 6.3.3 Human effort expended",
    wcag: "WCAG SC 3.3.2 Labels or Instructions; SC 2.4.6 Headings and Labels",
  },
  "CS-4": {
    coga: "COGA: Clear component purpose",
    iso: "ISO 9241-11:2018 6.2.2 Accuracy",
    wcag: "WCAG SC 2.4.2 Page Titled; SC 2.4.6 Headings and Labels",
  },
  "CS-5": {
    coga: "COGA: Predictable navigation cues",
    iso: "ISO 9241-11:2018 6.3.2 Time used; 6.3.3 Human effort expended",
    wcag: "WCAG SC 2.4.1 Bypass Blocks; SC 2.4.5 Multiple Ways",
  },
  "CS-6": {
    coga: "COGA: Provide direct lookup for content-heavy pages",
    iso: "ISO 9241-11:2018 6.3.2 Time used",
    wcag: "WCAG SC 2.4.5 Multiple Ways; SC 3.3.2 Labels or Instructions",
  },
  "CS-7": {
    coga: "COGA: Explicit labels and instructions",
    iso: "ISO 9241-11:2018 6.2.2 Accuracy",
    wcag: "WCAG SC 4.1.2 Name, Role, Value; SC 3.3.2 Labels or Instructions",
  },
  "CS-8": {
    coga: "COGA: Predictable interactions",
    iso: "ISO 9241-11:2018 6.2.2 Accuracy; 6.3.3 Human effort expended",
    wcag: "WCAG SC 3.2.4 Consistent Identification",
  },
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

function dimensionBaseOrderIndex(name) {
  const order = [
    INFORMATION_OVERLOAD_NAME,
    "Readability",
    "Interaction & Distraction",
    "Consistency",
  ];
  const index = order.indexOf(canonicalDimensionName(name));
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function compareDimensionEntriesByRisk(left, right) {
  const scoreDelta = normalizedScore(left?.score) - normalizedScore(right?.score);
  if (scoreDelta !== 0) {
    return scoreDelta;
  }
  const issueDelta = (right?.issueCount || 0) - (left?.issueCount || 0);
  if (issueDelta !== 0) {
    return issueDelta;
  }
  return dimensionBaseOrderIndex(left?.name) - dimensionBaseOrderIndex(right?.name);
}

function activeProfileDimensionScoreMap(result) {
  const profileSourceName = profileSourceNameForLabel(result, state.activeProfile);
  const entries = buildProfileDimensionEntries(result, profileSourceName);
  const scoreMap = new Map();
  entries.forEach((entry) => {
    scoreMap.set(canonicalDimensionName(entry.name), normalizedScore(entry.score));
  });
  return scoreMap;
}

function compareDimensionsByActiveProfileRisk(left, right, scoreMap) {
  const leftKey = canonicalDimensionName(left?.dimension);
  const rightKey = canonicalDimensionName(right?.dimension);
  const leftScore = scoreMap.get(leftKey);
  const rightScore = scoreMap.get(rightKey);
  const scoreDelta = (Number.isFinite(leftScore) ? leftScore : normalizedScore(left?.score))
    - (Number.isFinite(rightScore) ? rightScore : normalizedScore(right?.score));
  if (scoreDelta !== 0) {
    return scoreDelta;
  }
  const issueDelta = (right?.issues?.length || 0) - (left?.issues?.length || 0);
  if (issueDelta !== 0) {
    return issueDelta;
  }
  return dimensionBaseOrderIndex(left?.dimension) - dimensionBaseOrderIndex(right?.dimension);
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

  const profileLabelForSlide = (slide) => (
    slide?.label === "ADHD" || slide?.label === "Autism" ? slide.label : "Dyslexia"
  );

  const updateControls = () => {
    const currentSlide = slides[currentIndex] || null;
    state.activeProfile = profileLabelForSlide(currentSlide);
    dotNodes.forEach((dot, index) => {
      const active = index === currentIndex;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-pressed", active ? "true" : "false");
    });
    renderDimensionBars(currentSlide?.dimensionEntries || []);
    if (state.currentResult) {
      renderExplanation(state.currentResult);
      renderDashboardSummary(state.currentResult);
      if (state.workspaceMode === "explanation") {
        renderComparison(state.currentResult, state.previousResult, state.previousSourceName);
      }
    }
  };

  const goToSlide = (targetIndex) => {
    const previousProfile = state.activeProfile;
    currentIndex = Math.max(0, Math.min(dotNodes.length - 1, targetIndex));
    const nextProfile = profileLabelForSlide(slides[currentIndex]);
    if (nextProfile !== previousProfile) {
      resetIssueWorkspaceForProfileChange();
    }
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

function riskMetaFromScore(score) {
  const riskIndex = 100 - normalizedScore(score);
  if (riskIndex <= 25) {
    return {
      level: "Low risk",
      className: "risk-low",
    };
  }
  if (riskIndex <= 60) {
    return {
      level: "Medium risk",
      className: "risk-medium",
    };
  }
  return {
    level: "High risk",
    className: "risk-high",
  };
}

function renderDimensionBars(dimensionEntries) {
  const dimensionBars = document.getElementById("dimensionBars");
  if (!dimensionBars) {
    return;
  }

  const dimensionRows = [...(dimensionEntries || [])]
    .sort(compareDimensionEntriesByRisk)
    .map(({ name, score }) => {
    const riskMeta = riskMetaFromScore(score);
    const dimensionKey = displayDimensionName(name);
    const issueCategoryName = displayIssueCategoryName(name);
    const tooltipCopy = tooltipCopyForDimension(dimensionKey);
    return `
      <button class="dimension-row dimension-highlight-trigger" type="button" data-highlight-dimension="${escapeHtml(name)}" data-dimension-key="${escapeHtml(dimensionKey)}" data-risk-level="${escapeHtml(riskMeta.level)}" aria-label="${escapeHtml(`${issueCategoryName}: ${riskMeta.level}. Highlight this category on the website.`)}">
        <span class="dimension-label-with-info">
          <span>${escapeHtml(issueCategoryName)}</span>
          <span
            class="dimension-info-icon"
            tabindex="0"
            role="button"
            aria-label="${escapeHtml(`${issueCategoryName} info`)}"
            data-tip-issue="${escapeHtml(tooltipCopy.issue)}"
            data-tip-impact="${escapeHtml(tooltipCopy.impact)}"
          >i</span>
        </span>
        <span class="risk-badge ${riskMeta.className}">${riskMeta.level}</span>
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

  const totalIssues = result.dimensions.reduce((count, dimension) => {
    return count + (dimension.issues || []).length;
  }, 0);

  summaryNode.innerHTML = `
    <div class="summary-line summary-issues">Total number of issues: ${totalIssues} issues detected</div>
  `;
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
      issue: "Too many competing elements make the primary task hard to identify.",
      impact: "We check first-screen focal density, competing CTAs, sidebar or promo interference, and hierarchy clarity.",
    },
    Readability: {
      issue: "Text is harder to read, scan, or understand quickly.",
      impact: "We measure sentence and paragraph length, wording complexity, instruction clarity, and chunking quality.",
    },
    "Interaction & Distraction": {
      issue: "Motion, autoplay, or interruptions pull attention away from the current task.",
      impact: "We detect autoplay media, excessive animation, and interruptive overlays or popups.",
    },
    Consistency: {
      issue: "Structure and controls are not consistent enough for fast orientation.",
      impact: "We check heading hierarchy, location and progress cues, control naming, and label consistency.",
    },
  };
  return tooltipMap[normalized] || {
    issue: "This dimension reflects cognitive-accessibility risk in task flow.",
    impact: "We score structural clarity, readability, interaction stability, and predictability signals.",
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

function firstSentence(text) {
  const value = String(text || "").trim();
  const match = value.match(/^(.+?[.!?])\s/);
  return match ? match[1] : value;
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

function wcagStandardsMarkup(summaryText) {
  const items = splitStandardItems(summaryText, "SC 2.4.6 Headings and Labels");
  const normalizedItems = items.map((item) => (
    item.replace(/^WCAG\s*2\.2\s*/i, "").replace(/^WCAG\s*/i, "").trim()
  ));
  const criteria = normalizedItems.filter(Boolean).map((item) => (
    /^SC\s+/i.test(item) ? item : `SC ${item}`
  ));
  const visibleCriteria = criteria.length ? criteria : ["SC 2.4.6 Headings and Labels"];
  return `
    <div class="issue-standards-list">
      ${visibleCriteria.map((item) => `<span class="issue-standard-pill">${escapeHtml(item)}</span>`).join("")}
    </div>
  `;
}

function beneficiaryTags(ruleId, dimensionName) {
  const prefix = String(ruleId || "").split("-")[0] || "";
  const byPrefix = {
    IO: ["Reading difficulties", "Attention regulation"],
    RD: ["Reading difficulties", "Communication differences"],
    ID: ["Attention regulation", "Autistic users"],
    CS: ["Autistic users", "Executive function support"],
  };
  if (byPrefix[prefix]) {
    return byPrefix[prefix];
  }
  if (dimensionName === "Readability") return byPrefix.RD;
  if (dimensionName === "Interaction & Distraction") return byPrefix.ID;
  if (dimensionName === "Consistency") return byPrefix.CS;
  return byPrefix.IO;
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
  if (location.selector) {
    return `${elementPrefix}CSS selector: ${location.selector}${textHint}`;
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

  // Guidance should show concrete affected elements, not deduplicated labels,
  // so the visible list matches the affected-element count users see above.
  const shownLocations = locations.slice(0, 12);
  const hiddenCount = Math.max(0, locations.length - shownLocations.length);
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
    "RD-1": [
      "Split long sentences into shorter, direct statements.",
      "Keep each sentence focused on one main idea.",
    ],
    "RD-2": [
      "Break long paragraphs or list items into smaller chunks.",
      "Add subheadings, lists, or spacing so readers can scan before reading in full.",
    ],
    "RD-3": [
      "Replace vague labels with specific action labels that state what will happen.",
      "Use labels such as \"View event details\" or \"Continue to payment\" instead of \"Click here\" or \"Learn more\".",
    ],
    "RD-4": [
      "Replace dense or specialist words with familiar terms where possible.",
      "Keep necessary technical terms, but explain them in plain language.",
    ],
    "RD-5": [
      "Rewrite instructions as short, direct steps.",
      "Separate conditions or exceptions into small, easy-to-scan chunks.",
    ],
    "RD-6": [
      "Break long prose into smaller grouped chunks.",
      "Use lists, short sub-sections, or clearly separated steps to reduce scanning effort.",
    ],
    "IO-1": [
      "Choose one primary reading path or task for the first screen.",
      "Reduce or demote competing headings, media, panels, and calls to action.",
    ],
    "IO-2": [
      "Split the dense region into smaller chunks.",
      "Reveal secondary content progressively instead of showing every item at once.",
    ],
    "IO-3": [
      "Demote or remove non-essential side panels and promotional blocks.",
      "Keep supporting content visually quieter than the main reading path.",
    ],
    "IO-4": [
      "Make one primary call to action visually dominant.",
      "Group secondary actions together so users do not compare too many same-level choices.",
    ],
    "IO-5": [
      "Strengthen one top-level heading and one obvious next step.",
      "Reduce competing headings or equally prominent actions near the start of the page.",
    ],
    "ID-1": [
      "Disable autoplay by default.",
      "Use a user-initiated play control when motion or media is part of the main task.",
    ],
    "ID-2": [
      "Reduce non-essential motion and continuously moving components.",
      "Keep each main region to only one or two animated elements where motion is necessary.",
    ],
    "ID-3": [
      "Avoid showing popups, sticky prompts, or overlay CTAs on initial load.",
      "Keep optional prompts collapsed until the user asks for them.",
    ],
    "CS-1": [
      "Add one clear h1 that describes the page purpose.",
      "Use lower-level headings in order to mark major sections.",
    ],
    "CS-2": [
      "Add breadcrumbs or mark the active navigation item.",
      "Use aria-current where it helps users confirm their current location.",
    ],
    "CS-3": [
      "Add progress text such as \"Step 2 of 4\" or a visible stepper.",
      "Keep the active step clearly marked before users continue.",
    ],
    "CS-4": [
      "Use a specific document title and descriptive h1.",
      "Add a short introductory cue that explains the page purpose or primary task.",
    ],
    "CS-5": [
      "Provide a clear primary navigation landmark.",
      "Label multiple navigation regions and keep link names specific.",
    ],
    "CS-6": [
      "Add a clearly labelled search landmark or search field.",
      "Pair the search input with a clear search submit button.",
    ],
    "CS-7": [
      "Give every control a clear accessible name.",
      "Connect tabs, accordions, menus, or expand controls to the content they affect.",
    ],
    "CS-8": [
      "Use one consistent label for each repeated action pattern.",
      "Avoid switching terms for the same action across the page.",
    ],
  };

  const fallbackSteps = {
    "Readability": [
      "Rewrite the affected content so it is shorter and easier to scan.",
      "Use familiar wording and clear structure around the affected area.",
    ],
    "Interaction & Distraction": [
      "Remove automatic interruptions or motion that starts before users choose it.",
      "Keep the primary task visible and stable while users are reading or deciding.",
    ],
    "Consistency": [
      "Make headings, labels, and navigation patterns consistent.",
      "Make the next step predictable before asking users to act.",
    ],
    "Information Overload": [
      "Choose one primary reading path or task for this area.",
      "Demote secondary banners, panels, media, or calls to action that compete with it.",
    ],
  };

  const selectedSteps = ruleSteps[ruleId] || fallbackSteps[category] || fallbackSteps["Information Overload"];
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
    "RD-1": "Make each sentence short enough to understand without re-reading.",
    "RD-2": "Turn dense text blocks into smaller, scannable chunks.",
    "RD-3": "Make every action label clearly describe the next result.",
    "RD-4": "Use familiar wording that users can decode quickly.",
    "RD-5": "Make instructions direct, sequential, and easy to scan.",
    "RD-6": "Break long prose into clear sections that users can scan.",
    "IO-1": "Reduce competing focal points and support one dominant task path.",
    "IO-2": "Reduce the amount users must compare in one region.",
    "IO-3": "Keep the main reading path stronger than supporting content.",
    "IO-4": "Make one primary action clearly more important than secondary actions.",
    "IO-5": "Make the page purpose and first next step obvious.",
    "ID-1": "Keep media under user control instead of starting automatically.",
    "ID-2": "Use motion only when it supports the current task.",
    "ID-3": "Avoid interruptions before users finish the main reading or task path.",
    "CS-1": "Create a predictable heading hierarchy.",
    "CS-2": "Make the current page location visible.",
    "CS-3": "Make multi-step progress visible and predictable.",
    "CS-4": "Make the page purpose clear before users act.",
    "CS-5": "Make navigation landmarks and link groups easy to recognise.",
    "CS-6": "Make search easy to find and understand.",
    "CS-7": "Make controls announce what they affect.",
    "CS-8": "Use stable wording for repeated actions.",
  };

  if (goals[ruleId]) {
    return goals[ruleId];
  }
  if (category === "Readability") {
    return "Make the affected content easier to read and scan.";
  }
  if (category === "Interaction & Distraction") {
    return "Keep users in control of motion and interruptions.";
  }
  if (category === "Consistency") {
    return "Make navigation, labels, and next actions predictable.";
  }
  return "Reduce competing focal points and support one dominant task path.";
}

function issueDoneWhenText(issue, dimensionName) {
  const ruleId = issue?.rule_id || "";
  const category = displayDimensionName(dimensionName);

  // Success checks make the guidance testable for designers after redesigning.
  const checks = {
    "RD-1": "Done when each sentence communicates one idea without forcing re-reading.",
    "RD-2": "Done when long text is split into shorter chunks with clear scan points.",
    "RD-3": "Done when each button or link can be understood without surrounding context.",
    "RD-4": "Done when key wording is familiar or briefly explained.",
    "RD-5": "Done when instructions can be followed step by step without rereading conditions.",
    "RD-6": "Done when users can scan section headings or chunks before reading in full.",
    "IO-1": "Done when one clear primary focus is visible above the fold.",
    "IO-2": "Done when users do not need to compare many same-level items at once.",
    "IO-3": "Done when side content no longer competes with the main reading path.",
    "IO-4": "Done when the primary action is visually dominant and secondary actions are grouped.",
    "IO-5": "Done when the page purpose and next step are clear on first scan.",
    "ID-1": "Done when media starts only after the user chooses it.",
    "ID-2": "Done when non-essential motion is removed or reduced.",
    "ID-3": "Done when popups or sticky prompts no longer interrupt the first task path.",
    "CS-1": "Done when headings follow a clear order from the main page heading down.",
    "CS-2": "Done when users can tell where they are in the site or flow.",
    "CS-3": "Done when the current step and remaining progress are visible.",
    "CS-4": "Done when title, heading, and intro all describe the same page purpose.",
    "CS-5": "Done when primary navigation is easy to find and each nav group is labelled.",
    "CS-6": "Done when search has a clear label and action.",
    "CS-7": "Done when each control name and affected content relationship is clear.",
    "CS-8": "Done when repeated actions use the same wording everywhere.",
  };

  if (checks[ruleId]) {
    return checks[ruleId];
  }
  if (category === "Readability") {
    return "Done when key passages are short, clear, and scannable without re-reading.";
  }
  if (category === "Interaction & Distraction") {
    return "Done when non-essential autoplay or pop-up interruptions are removed.";
  }
  if (category === "Consistency") {
    return "Done when repeated UI patterns use consistent labels and interaction flow.";
  }
  return "Done when one clear primary focus is visible above the fold.";
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

function resetIssueWorkspaceForProfileChange() {
  // A profile switch changes the audience lens, so old issue guidance/highlights
  // should not stay visible under a different user group.
  state.selectedIssueId = "";
  state.activeHighlightDimension = "";
  state.activeHighlightIssueId = "";
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
    setWebsiteStatus("Select an issue and choose Show highlighted location to highlight it in the preview.");
    return;
  }

  const model = issueDisplayModel(selected.issue, selected.dimension.dimension);
  titleNode.textContent = `Highlighted issue: ${model.issueTitle}`;
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
  const highlighted = applyHighlights(elements, config.color, (_element, index) => `Element ${index}`);
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
  highlightSelectedIssueInPreview();
}

function issueSummaryCardMarkup(issue, dimensionName, issueNumber) {
  const issueId = issueDomId(dimensionName, issue.rule_id);
  const isSelected = issueId === state.selectedIssueId;
  const isPreviewActive = isSelected && state.rightPanelMode === "preview";
  const isDetailActive = isSelected
    && state.rightPanelMode === "detail"
    && state.workspaceMode === "explanation";
  const selectedClass = isSelected ? " is-selected is-active" : "";
  const { wcag: wcagSummary, iso: isoSummary } = issueCardStandardsSummary(issue.rule_id || "");
  const wcagMarkup = wcagStandardsMarkup(wcagSummary);
  const isoMarkup = standardsPillsMarkup(isoSummary, "Effectiveness, efficiency, satisfaction.");

  return `
    <article
      class="issue-highlight-button issue-summary-card${selectedClass}"
      data-highlight-issue="${escapeHtml(issue.rule_id)}"
      data-highlight-dimension="${escapeHtml(dimensionName)}"
    >
      <div class="issue-summary-topline">
        <span class="issue-highlight-rule">Issue ${issueNumber}</span>
      </div>
      <strong class="issue-summary-title">${escapeHtml(issue.title || "Review this issue")}</strong>
      <div class="issue-summary-row issue-summary-row-standards">
        <span class="issue-highlight-label issue-highlight-label--wcag-guidance">WCAG Cognitive Accessibility Guidance</span>
        ${wcagMarkup}
      </div>
      <div class="issue-summary-row issue-summary-row-standards">
        <span class="issue-highlight-label">ISO 9241-11</span>
        ${isoMarkup}
      </div>
      <div class="issue-summary-actions">
        <button
          class="view-on-page-button${isPreviewActive ? " is-active" : ""}"
          type="button"
          data-view-on-page="${escapeHtml(issue.rule_id)}"
          data-view-dimension="${escapeHtml(dimensionName)}"
          aria-label="Show highlighted location for this issue on the analysed page"
          aria-pressed="${isPreviewActive ? "true" : "false"}"
        >Show highlighted location</button>
        <button
          class="view-details-button${isDetailActive ? " is-active" : ""}"
          type="button"
          data-view-issue="${escapeHtml(issue.rule_id)}"
          data-view-dimension="${escapeHtml(dimensionName)}"
          aria-label="Open this issue guidance in summary"
          aria-pressed="${isDetailActive ? "true" : "false"}"
        >Open guidance</button>
      </div>
    </article>
  `;
}

function renderExplanation(result) {
  const explanationContent = document.getElementById("explanationContent");
  if (!explanationContent) {
    return;
  }

  const scoreMap = activeProfileDimensionScoreMap(result);
  const orderedDimensions = [...result.dimensions]
    .sort((left, right) => compareDimensionsByActiveProfileRisk(left, right, scoreMap));

  let globalIssueIndex = 0;
  const blocks = orderedDimensions.map((dimension) => {
    const filteredIssues = prioritizedIssuesForProfile(dimension);
    const issueCount = filteredIssues.length;
    const displayName = displayDimensionName(dimension.dimension);
    const issueCategoryName = displayIssueCategoryName(dimension.dimension);
    const cognitiveDimension = cognitiveDimensionLabel(dimension.dimension);
    const summary = issueCount === 0
      ? "No triggered issues in this category."
      : cognitiveDimension;

    const issues = issueCount
      ? `<div class="issue-highlight-list">${filteredIssues.map((issue, issueIndex) => (
          issueSummaryCardMarkup(issue, dimension.dimension, globalIssueIndex + issueIndex + 1)
        )).join("")}</div>`
      : "";
    globalIssueIndex += issueCount;

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
    // Issue-level highlights use numbered labels so the preview markers can
    // be matched back to the ordered element list in the guidance panel.
    const highlightLabel = typeof label === "function"
      ? label(element, highlighted.size + 1)
      : label;
    element.setAttribute("data-cognilens-highlight", highlightLabel);
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
    const isActive = (
      issueId === state.selectedIssueId
      && state.rightPanelMode === "preview"
    );
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  document.querySelectorAll("[data-view-issue]").forEach((button) => {
    const issueId = issueDomId(button.dataset.viewDimension, button.dataset.viewIssue);
    const isActive = issueId === state.selectedIssueId
      && state.rightPanelMode === "detail"
      && state.workspaceMode === "explanation";
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

  const highlighted = applyHighlights(elements, config.color, (_element, index) => `Element ${index}`);
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

function printProfileLabels(result) {
  const labels = buildScoreSlides(result).map((slide) => slide.label);
  const preferredOrder = ["Dyslexia", "ADHD", "Autism"];
  return preferredOrder.filter((label) => labels.includes(label));
}

function profileSourceNameForLabel(result, profileLabel) {
  return (result.profile_scores || []).find((profile) => (
    displayProfileName(profile.name) === profileLabel
  ))?.name || profileLabel;
}

function printProfileDimensionRows(result, profileLabel) {
  const profileSourceName = profileSourceNameForLabel(result, profileLabel);
  return buildProfileDimensionEntries(result, profileSourceName).map(({ name, score }) => {
    const riskMeta = riskMetaFromScore(score);
    return `
      <div class="print-profile-risk-row">
        <span>${escapeHtml(displayIssueCategoryName(name))}</span>
        <span class="risk-badge ${riskMeta.className}">${escapeHtml(riskMeta.level)}</span>
      </div>
    `;
  }).join("");
}

function printIssueCardMarkup(issue, dimensionName, issueNumber) {
  const firstFix = conciseText(issue.suggestion, "Review this issue and simplify the interaction.", 180);
  const description = conciseText(issue.description, "This issue may increase cognitive effort for users.", 220);
  return `
    <article class="print-issue-card">
      <div class="print-issue-card__meta">
        <span>Issue ${issueNumber}</span>
        <span>${escapeHtml(issue.severity || "review")}</span>
      </div>
      <h4>${escapeHtml(issue.title || "Review this issue")}</h4>
      <p>${escapeHtml(description)}</p>
      <p><strong>First fix:</strong> ${escapeHtml(firstFix)}</p>
      <div class="print-issue-card__tags">
        ${pillListMarkup(issueIsoClauseTags(issue.rule_id), 99, "iso")}
      </div>
    </article>
  `;
}

function printProfileDimensionCards(result, profileLabel) {
  let issueNumber = 0;
  return DIMENSION_CONFIG.map(({ name }) => {
    const dimension = findDimension(result, name);
    const issues = dimension?.issues || [];
    const issueCards = issues.map((issue) => {
      issueNumber += 1;
      return printIssueCardMarkup(issue, dimension?.dimension || name, issueNumber);
    }).join("");
    return `
      <details class="print-profile-dimension-card" open>
        <summary>
          <span>${escapeHtml(displayIssueCategoryName(name))}</span>
          <strong>${issues.length}</strong>
        </summary>
        <div class="print-profile-dimension-body">
          ${issues.length ? issueCards : `<p class="print-empty-note">No triggered issues for this profile in this dimension.</p>`}
        </div>
      </details>
    `;
  }).join("");
}

function renderPrintableProfileReport(result) {
  const printProfileReport = document.getElementById("printProfileReport");
  if (!printProfileReport) {
    return;
  }

  const labels = printProfileLabels(result);
  printProfileReport.innerHTML = labels.map((profileLabel) => `
    <section class="print-profile-section">
      <h2>${escapeHtml(profileLabel)}</h2>
      <div class="print-profile-risk-list">
        ${printProfileDimensionRows(result, profileLabel)}
      </div>
      <div class="print-profile-dimension-list">
        ${printProfileDimensionCards(result, profileLabel)}
      </div>
    </section>
  `).join("");
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
  renderPrintableProfileReport(result);
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
    if (state.workspaceMode === "explanation") {
      renderComparison(state.currentResult, state.previousResult, state.previousSourceName);
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

function initPreviewMessageBridge() {
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
  const assistantForm = document.getElementById("assistantForm");
  const assistantInput = document.getElementById("assistantInput");
  const clearButton = document.getElementById("clearAssistantButton");
  const sidebarToggleButton = document.getElementById("sidebarToggleButton");
  const websitePreviewFrame = document.getElementById("websitePreviewFrame");
  const dimensionBars = document.getElementById("dimensionBars");
  const explanationContent = document.getElementById("explanationContent");
  const navLinks = Array.from(document.querySelectorAll(".app-nav-links a[href]"));
  initAssistantFloating();
  initPreviewMessageBridge();
  initDimensionInfoTooltip();
  initBackToAnalysisButton();

  if (printButton) {
    printButton.addEventListener("click", () => {
      printDashboardReport({ restoreMode: state.workspaceMode });
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

  if (dimensionBars) {
    dimensionBars.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-highlight-dimension]");
      if (trigger) {
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
      openIssueInSummary(detailTrigger.dataset.viewDimension, detailTrigger.dataset.viewIssue);
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
      sourceUrl: isProbablyUrl(sourceName) ? sourceName : "",
    },
    previous: null,
  };
}

async function loadDashboardSessionWithHistoryFallback() {
  const runId = getHistoryReportRunIdFromUrl();
  if (runId) {
    const detail = await fetchJson(`${API_BASE}/history/${encodeURIComponent(runId)}`);
    return buildDashboardSessionFromHistoryDetail(detail);
  }

  const storedSession = loadDashboardSession();
  return storedSession;
}

function renderMissingAnalysisState() {
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
  if (lifecycleSnapshot !== dashboardLifecycle) {
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
  if (sourceNode) {
    sourceNode.textContent = state.sourceName;
  }

  renderResult(
    currentResult,
    currentSession.html || currentSession.payload.html_content || "",
  );
  initHistoryContextPanel();
  renderComparison(currentResult, previousResult, previousSession?.sourceName || "");
  // Default first entry to the raw website preview.
  setWorkspaceMode("website");
  startBackgroundRenderedAnalysis();

  if (sessionStorage.getItem(AUTO_PRINT_STORAGE_KEY) === "true") {
    sessionStorage.removeItem(AUTO_PRINT_STORAGE_KEY);
    window.setTimeout(() => {
      printDashboardReport();
    }, 150);
  }
}

/** Bumped when the React dashboard route unmounts so in-flight init() does not paint a torn-down DOM. */
let dashboardLifecycle = 0;

export function notifyDashboardUnmount() {
  dashboardLifecycle += 1;
}

export async function initDashboard() {
  const snapshot = dashboardLifecycle;
  try {
    await init(snapshot);
  } catch (error) {
    if (snapshot !== dashboardLifecycle) {
      return;
    }
    document.body.innerHTML = `<pre style="padding:24px;">${escapeHtml(String(error))}</pre>`;
  }
}
