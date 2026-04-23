import {
  buildAnalysisView,
  chatWithAssistant,
  escapeHtml,
  findDimension,
  loadDashboardSession,
} from "./common.js";

const state = {
  currentHtml: "",
  currentResult: null,
  currentPayload: null,
  sourceName: "",
  sourceUrl: "",
  workspaceMode: "explanation",
  activeHighlightDimension: "",
  activeHighlightIssueId: "",
  chatMessages: [],
  chatPending: false,
  sidebarCollapsed: false,
  assistantFloatingOpen: false,
};

const SIDEBAR_STORAGE_KEY = "cognilens.sidebar.collapsed";
const SIDEBAR_WIDTH_STORAGE_KEY = "cognilens.sidebar.width";
const ASSISTANT_POSITION_STORAGE_KEY = "cognilens.assistant.position";
const AUTO_PRINT_STORAGE_KEY = "cognilens.dashboard.autoPrint";
const DEFAULT_SIDEBAR_WIDTH = 360;
const MIN_SIDEBAR_WIDTH = 320;
const MAX_SIDEBAR_WIDTH = 560;
const ASSISTANT_MARGIN = 16;

const DIMENSION_CONFIG = [
  { name: "Visual Complexity", className: "visual" },
  { name: "Readability", className: "readability" },
  { name: "Interaction & Distraction", className: "interaction" },
  { name: "Consistency", className: "consistency" },
];

const HIGHLIGHT_CONFIG = {
  "Visual Complexity": {
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
      "button",
      "a",
      "[role='button']",
      "video",
      "audio",
      "iframe",
      "[autoplay]",
      "[class*='cta' i]",
      "[class*='button' i]",
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

function deltaMeta(currentScore, previousScore) {
  const delta = currentScore - previousScore;
  return {
    delta,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
    label: delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${delta}`,
  };
}

function renderScoreRing(score) {
  const scoreRing = document.getElementById("scoreRing");
  const overallScore = document.getElementById("leftOverallScore");
  if (!scoreRing || !overallScore) {
    return;
  }
  overallScore.textContent = score;
  scoreRing.style.setProperty("--score", `${score}`);
}

function renderDimensionBars(result) {
  const dimensionBars = document.getElementById("dimensionBars");
  if (!dimensionBars) {
    return;
  }

  dimensionBars.innerHTML = DIMENSION_CONFIG.map(({ name, className }) => {
    const dimension = findDimension(result, name);
    const score = dimension ? dimension.score : 0;
    const issueCount = dimension?.issues?.length || 0;
    return `
      <button class="dimension-row dimension-highlight-trigger" type="button" data-highlight-dimension="${escapeHtml(name)}" aria-label="Highlight ${escapeHtml(name)} issues on the website">
        <span>${escapeHtml(name)}</span>
        <div class="bar-track"><div class="bar-fill ${className}" style="width:${score}%"></div></div>
        <strong>${score}</strong>
        <em>${issueCount}</em>
      </button>
    `;
  }).join("");
}

function renderDashboardSummary(result) {
  const summaryNode = document.getElementById("dashboardSummaryText");
  const riskNode = document.getElementById("dashboardRiskLabel");

  if (!summaryNode || !riskNode) {
    return;
  }

  const totalIssues = result.dimensions.reduce(
    (count, dimension) => count + (dimension.issues?.length || 0),
    0,
  );

  const statusLabel = scoreStatus(result.overall_score);
  riskNode.textContent = statusLabel;

  summaryNode.innerHTML = `
    <div class="summary-line summary-issues">Total number of issues: ${totalIssues} issues detected</div>
  `;
}

const SEVERITY_RANK = {
  critical: 3,
  major: 2,
  minor: 1,
};

const DIMENSION_BARRIER_COPY = {
  "Visual Complexity": "Visual clutter is making it harder to identify the main content and decide where to look first.",
  Readability: "Text complexity is increasing reading effort and making the main message harder to process.",
  "Interaction & Distraction": "Interactive or moving elements are competing for attention and making the next action less clear.",
  Consistency: "Structural inconsistency is increasing wayfinding effort and making the page flow harder to predict.",
};

function totalIssueCount(result) {
  return (result?.dimensions || []).reduce(
    (count, dimension) => count + (dimension.issues?.length || 0),
    0,
  );
}

function issuePriority(issue) {
  return (SEVERITY_RANK[issue?.severity] || 0) * 100 + (issue?.penalty || 0);
}

function primaryIssueForDimension(dimension) {
  return [...(dimension?.issues || [])].sort((a, b) => issuePriority(b) - issuePriority(a))[0] || null;
}

function priorityDimension(result) {
  return [...(result?.dimensions || [])]
    .filter((dimension) => (dimension.issues?.length || 0) > 0)
    .sort((a, b) => {
      const scoreDelta = a.score - b.score;
      if (scoreDelta !== 0) return scoreDelta;
      const issueDelta = (b.issues?.length || 0) - (a.issues?.length || 0);
      if (issueDelta !== 0) return issueDelta;
      return issuePriority(primaryIssueForDimension(b)) - issuePriority(primaryIssueForDimension(a));
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
  const comparisonList = document.getElementById("comparisonList");
  const comparisonMeta = document.getElementById("comparisonMeta");
  const comparisonSummary = document.getElementById("comparisonSummary");
  if (!comparisonList || !comparisonMeta || !comparisonSummary) {
    return;
  }

  const priority = priorityDimension(currentResult);
  const currentIssues = totalIssueCount(currentResult);

  if (!priority) {
    comparisonMeta.textContent = previousResult ? "Evidence" : "No active issue";
    comparisonSummary.className = "comparison-summary up";
    comparisonSummary.innerHTML = `
      <strong>No urgent cognitive barrier</strong>
      <span>The current page does not trigger the active MVP rules. Keep checking with users if the page still feels difficult to understand or navigate.</span>
    `;
    comparisonList.className = "comparison-list priority-evidence-list empty";
    comparisonList.textContent = previousResult
      ? "No triggered issues remain in the current rule set. Use history to review earlier evidence if needed."
      : "Analyze a denser or revised page to collect priority evidence.";
    return;
  }

  const primaryIssue = primaryIssueForDimension(priority);
  const ruleIds = priority.issues.map((issue) => issue.rule_id).join(", ");
  const fixSteps = uniqueSuggestions(priority.issues);
  const comparisonEvidence = previousResult
    ? (() => {
        const overallMeta = deltaMeta(currentResult.overall_score, previousResult.overall_score);
        const previousIssues = totalIssueCount(previousResult);
        const issueDelta = currentIssues - previousIssues;
        const issueDeltaLabel = issueDelta === 0
          ? "No issue-count change"
          : `${Math.abs(issueDelta)} ${issueDelta < 0 ? "fewer" : "more"} issue${Math.abs(issueDelta) === 1 ? "" : "s"}`;
        return `
          <li><strong>Compared with:</strong> ${escapeHtml(previousSourceName || "previous run")}</li>
          <li><strong>Overall movement:</strong> ${previousResult.overall_score} → ${currentResult.overall_score} (${overallMeta.label})</li>
          <li><strong>Issue movement:</strong> ${previousIssues} → ${currentIssues} (${issueDeltaLabel})</li>
        `;
      })()
    : `
        <li><strong>Comparison:</strong> No baseline yet. Re-analyze a revised version to check whether cognitive load indicators improve.</li>
      `;

  comparisonMeta.textContent = primaryIssue ? primaryIssue.rule_id : priority.dimension;
  comparisonSummary.className = "comparison-summary priority";
  comparisonSummary.innerHTML = `
    <strong>Primary cognitive barrier</strong>
    <span>${escapeHtml(DIMENSION_BARRIER_COPY[priority.dimension] || firstSentence(primaryIssue?.description))}</span>
  `;
  comparisonList.className = "comparison-list priority-evidence-list";
  comparisonList.innerHTML = `
    <article class="priority-card">
      <span class="priority-eyebrow">Why it matters</span>
      <p>${escapeHtml(primaryIssue?.description || "This pattern may increase cognitive load for users with cognitive or communication needs.")}</p>
    </article>

    <article class="priority-card">
      <span class="priority-eyebrow">Fix first</span>
      <ol class="priority-steps">
        ${fixSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
      </ol>
    </article>

    <article class="priority-card evidence">
      <span class="priority-eyebrow">Evidence</span>
      <ul class="priority-evidence">
        <li><strong>Weakest active dimension:</strong> ${escapeHtml(priority.dimension)} (${priority.score})</li>
        <li><strong>Triggered rules:</strong> ${escapeHtml(ruleIds)}</li>
        ${comparisonEvidence}
      </ul>
    </article>
  `;
}

function renderExplanation(result) {
  const explanationContent = document.getElementById("explanationContent");
  if (!explanationContent) {
    return;
  }

  const blocks = result.dimensions.map((dimension) => {
    const issueCount = dimension.issues.length;
    const summary = issueCount === 0
      ? "No issues were triggered in this dimension for the current analysis."
      : `${issueCount} issue${issueCount === 1 ? "" : "s"} were triggered in this dimension. These patterns may affect attention, working memory, comprehension, wayfinding, or decision confidence for users with cognitive or communication needs.`;

    const issues = issueCount
      ? `<div class="issue-highlight-list">${dimension.issues.map((issue) => `
          <button
            class="issue-highlight-button"
            type="button"
            data-highlight-issue="${escapeHtml(issue.rule_id)}"
            data-highlight-dimension="${escapeHtml(dimension.dimension)}"
            aria-label="Highlight ${escapeHtml(issue.rule_id)} on the website"
          >
            <strong>${escapeHtml(issue.rule_id)}</strong>
            <span>${escapeHtml(issue.description)}</span>
          </button>
        `).join("")}</div>`
      : "";

    return `
      <section class="explanation-block">
        <h3>${escapeHtml(dimension.dimension)} (Score: ${dimension.score})</h3>
        <p>${escapeHtml(summary)}</p>
        ${issues}
      </section>
    `;
  });

  explanationContent.className = "pane-scroll rich-text";
  explanationContent.innerHTML = blocks.join("");
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
  toggle.textContent = isWebsite ? "Back to explanation" : "Click to view the website";

  if (isWebsite) {
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

function buildGuardedPreviewHtml(html) {
  const guardMarkup = `
<base href="about:srcdoc">
<script>
(() => {
  if (window.__cognilensPreviewGuard) return;
  window.__cognilensPreviewGuard = true;

  const normalize = (value) => String(value || "").replace(/\\s+/g, " ").trim();
  const describeControl = (control) => {
    const label = normalize(
      control.textContent
      || control.getAttribute("aria-label")
      || control.getAttribute("title")
      || control.getAttribute("href")
      || "interactive element"
    );
    return label ? '"' + label.slice(0, 48) + '"' : "this interactive element";
  };
  const notify = (message) => {
    try {
      window.parent.postMessage({ type: "cognilens-preview-interaction-blocked", message }, "*");
    } catch (_error) {}
  };

  document.addEventListener("click", (event) => {
    const target = event.target && event.target.closest ? event.target : event.target && event.target.parentElement;
    const control = target && target.closest && target.closest("a[href], button, [role='button'], input[type='button'], input[type='submit']");
    if (!control) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    notify("Preview interaction blocked: " + describeControl(control) + " is disabled to keep the analyzed page stable.");
    return false;
  }, true);

  document.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    notify("Preview form submission blocked to keep the analyzed page stable.");
    return false;
  }, true);
})();
<\/script>
`;

  const source = String(html || "");
  if (/<head[\s>]/i.test(source)) {
    return source.replace(/<head([^>]*)>/i, `<head$1>${guardMarkup}`);
  }
  return `${guardMarkup}${source}`;
}

function loadWebsitePreview() {
  const frame = document.getElementById("websitePreviewFrame");
  if (!frame) {
    return;
  }

  const previewUrl = getPreviewUrl();
  if (previewUrl) {
    const proxiedUrl = `/eye/proxy?url=${encodeURIComponent(previewUrl)}`;
    if (frame.dataset.previewUrl !== proxiedUrl) {
      frame.removeAttribute("srcdoc");
      frame.src = proxiedUrl;
      frame.dataset.previewUrl = proxiedUrl;
      setWebsiteStatus("Loading proxied website preview...");
    }
    return;
  }

  if (state.currentHtml) {
    if (frame.dataset.previewHtml !== state.currentHtml || frame.dataset.previewGuardVersion !== "2") {
      frame.removeAttribute("src");
      frame.srcdoc = buildGuardedPreviewHtml(state.currentHtml);
      frame.dataset.previewHtml = state.currentHtml;
      frame.dataset.previewGuardVersion = "2";
      setWebsiteStatus("Loaded uploaded HTML preview. Choose a dimension to highlight related areas.");
    }
    return;
  }

  setWebsiteStatus("No website preview is available for this analysis.", true);
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

function installPreviewInteractionGuard(doc) {
  if (!doc?.documentElement || doc.documentElement.dataset.cognilensInteractionGuard === "true") {
    return;
  }

  doc.documentElement.dataset.cognilensInteractionGuard = "true";

  const describeControl = (control) => {
    const label = normalizeInlineText(
      control.textContent
      || control.getAttribute?.("aria-label")
      || control.getAttribute?.("title")
      || control.getAttribute?.("href")
      || "interactive element",
    );
    return label ? `"${label.slice(0, 48)}"` : "this interactive element";
  };

  doc.addEventListener("click", (event) => {
    const target = event.target?.closest ? event.target : event.target?.parentElement;
    const control = target?.closest?.("a[href], button, [role='button'], input[type='button'], input[type='submit']");
    if (!control) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    setWebsiteStatus(`Preview interaction blocked: ${describeControl(control)} is disabled to keep the analyzed page stable.`);
  }, true);

  doc.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    setWebsiteStatus("Preview form submission blocked to keep the analyzed page stable.");
  }, true);
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
  if (ruleId === "VC-1") {
    return ["main *", "body > *", "section", "article", "nav", "button", "a", "img", "p", "li"];
  }
  if (ruleId === "VC-2") {
    return ["section", "article", "ul", "ol", ".card", "[class*='card' i]", "[class*='grid' i]"];
  }
  if (ruleId === "VC-3") {
    return ["aside", "[class*='sidebar' i]", "[class*='banner' i]", "[class*='popup' i]", "[class*='modal' i]", "[class*='sticky' i]"];
  }
  if (ruleId === "RD-1" || ruleId === "RD-2") {
    return ["p", "li", "article", "section"];
  }
  if (ruleId === "RD-3") {
    return ["button", "a", "[role='button']"];
  }
  if (ruleId === "ID-1") {
    return ["video[autoplay]", "audio[autoplay]", "iframe"];
  }
  if (ruleId === "ID-2") {
    return ["[style*='animation' i]", "[style*='transition' i]", "marquee", "video", "iframe", "[class*='animate' i]", "[class*='motion' i]"];
  }
  if (ruleId === "ID-3") {
    return ["button", "a", "[role='button']", "[class*='cta' i]", "[class*='primary' i]", "[class*='btn' i]"];
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
    button.classList.toggle("is-active", button.dataset.highlightIssue === state.activeHighlightIssueId);
  });
}

function highlightDimension(dimensionName) {
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
    setWebsiteStatus(`${dimensionName} has no triggered issues in this analysis.`);
    return;
  }

  const candidateElements = [];
  config.selectors.forEach((selector) => {
    frameDoc.querySelectorAll(selector).forEach((element) => {
      candidateElements.push(element);
    });
  });
  const highlighted = applyHighlights(candidateElements, config.color, dimensionName);

  const firstElement = highlighted.values().next().value;
  firstElement?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });

  if (highlighted.size) {
    setWebsiteStatus(`${highlighted.size} related area${highlighted.size === 1 ? "" : "s"} highlighted for ${dimensionName}.`);
  } else {
    setWebsiteStatus(`No directly highlightable elements were found for ${dimensionName}; this issue may describe a missing or page-level pattern.`, true);
  }
}

function highlightIssue(dimensionName, ruleId, force = false) {
  const issueId = `${dimensionName}:${ruleId}`;
  if (!force && state.workspaceMode === "website" && state.activeHighlightIssueId === issueId) {
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
  if (!frameDoc || !issue || !config) {
    setWebsiteStatus("The website preview is still loading. Try again in a moment.", true);
    return;
  }

  injectHighlightStyles(frameDoc);
  clearWebsiteHighlights(frameDoc);

  const locationElements = (issue.locations || []).flatMap((location) => (
    findElementsForLocation(frameDoc, location)
  ));

  let elements = locationElements;
  if (!elements.length) {
    elements = fallbackSelectorsForIssue(issue, dimensionName).flatMap((selector) => {
      try {
        return Array.from(frameDoc.querySelectorAll(selector));
      } catch (error) {
        return [];
      }
    });
  }

  const highlighted = applyHighlights(elements, config.color, ruleId);
  const firstElement = highlighted.values().next().value;
  firstElement?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });

  if (highlighted.size) {
    setWebsiteStatus(`${highlighted.size} area${highlighted.size === 1 ? "" : "s"} highlighted for ${ruleId}.`);
  } else {
    setWebsiteStatus(`No directly highlightable element was found for ${ruleId}. This may be a page-level or missing-element issue.`, true);
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
  ].join(" ");

  dimensionNode.innerHTML = DIMENSION_CONFIG.map(({ name }) => {
    const dimension = findDimension(result, name);
    const score = dimension ? dimension.score : 0;
    return `
      <article class="print-dimension-card">
        <span>${escapeHtml(name)}</span>
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
    dimensions: result.dimensions.map((dimension) => ({
      dimension: dimension.dimension,
      score: dimension.score,
      issues: dimension.issues.map((issue) => ({
        rule_id: issue.rule_id,
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
      content: "Ask me how to improve readability, reduce visual clutter, or fix specific issues.",
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

function renderResult(result, html) {
  state.currentResult = result;
  state.currentHtml = html || "";
  renderScoreRing(result.overall_score);
  renderDimensionBars(result);
  renderDashboardSummary(result);
  renderPrintSummary(result);
  renderExplanation(result);
  renderAssistantMessages();
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
    if (event.target.closest("button, input, textarea, a")) {
      return;
    }

    event.preventDefault();
    const startRect = assistantWindow.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    document.body.classList.add("dragging-assistant");
    dragHandle.setPointerCapture?.(event.pointerId);

    const handleMove = (moveEvent) => {
      setAssistantPosition(
        startRect.left + moveEvent.clientX - startX,
        startRect.top + moveEvent.clientY - startY,
      );
    };

    const handleUp = () => {
      document.body.classList.remove("dragging-assistant");
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
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
  window.addEventListener("message", (event) => {
    if (event.data?.type !== "cognilens-preview-interaction-blocked") {
      return;
    }
    setWebsiteStatus(String(event.data.message || "Preview interaction blocked to keep the analyzed page stable."));
  });
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
  initSidebarResize();
  initAssistantFloating();
  initPreviewMessageBridge();

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
      setWorkspaceMode(state.workspaceMode === "website" ? "explanation" : "website");
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
      }
    });
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-highlight-issue]");
    if (!trigger) {
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
      installPreviewInteractionGuard(doc);
      setWebsiteStatus("Website preview loaded. Choose a dimension to highlight related areas.");
      if (state.activeHighlightIssueId) {
        const [dimensionName, ruleId] = state.activeHighlightIssueId.split(":");
        highlightIssue(dimensionName, ruleId, true);
      } else if (state.activeHighlightDimension) {
        highlightDimension(state.activeHighlightDimension);
      }
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
