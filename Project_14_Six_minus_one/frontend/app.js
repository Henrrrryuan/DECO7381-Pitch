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
  chatMessages: [],
  chatPending: false,
  sidebarCollapsed: false,
};

const SIDEBAR_STORAGE_KEY = "cognilens.sidebar.collapsed";
const AUTO_PRINT_STORAGE_KEY = "cognilens.dashboard.autoPrint";

const DIMENSION_CONFIG = [
  { name: "Visual Complexity", className: "visual" },
  { name: "Readability", className: "readability" },
  { name: "Interaction & Distraction", className: "interaction" },
  { name: "Consistency", className: "consistency" },
];

function scoreStatus(score) {
  if (score >= 85) return "Strong";
  if (score >= 70) return "Moderate risk";
  if (score >= 50) return "Needs work";
  return "High risk";
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
    return `
      <div class="dimension-row">
        <span>${escapeHtml(name)}</span>
        <div class="bar-track"><div class="bar-fill ${className}" style="width:${score}%"></div></div>
        <strong>${score}</strong>
      </div>
    `;
  }).join("");
}

function renderDashboardSummary(result) {
  const summaryNode = document.getElementById("dashboardSummaryText");
  const statusNode = document.getElementById("dashboardStatus");
  const commentsNode = document.getElementById("overallComments");
  const lowest = result.min_dimension_score;
  const totalIssues = result.dimensions.reduce((count, dimension) => count + dimension.issues.length, 0);

  if (!summaryNode || !statusNode || !commentsNode) {
    return;
  }

  statusNode.textContent = scoreStatus(result.overall_score);
  summaryNode.textContent = [
    `Overall score ${result.overall_score}.`,
    `Lowest dimension ${lowest}.`,
    `${totalIssues} issues detected in this report.`,
  ].join(" ");

  commentsNode.textContent = totalIssues === 0
    ? "This version does not trigger any of the current heuristic rules. The page looks stable under the present MVP checks."
    : [
        `This interface currently sits in the "${scoreStatus(result.overall_score)}" band.`,
        `The weakest dimension score is ${lowest}, so that area is shaping the overall experience most strongly.`,
        `${totalIssues} rule hits are currently contributing to cognitive load in this version.`,
      ].join(" ");
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

  if (!previousResult) {
    comparisonMeta.textContent = "No baseline";
    comparisonSummary.className = "comparison-summary empty";
    comparisonSummary.textContent = "Analyze a revised version next to see overall score movement and dimension-level deltas.";
    comparisonList.className = "comparison-list empty";
    comparisonList.textContent = "Upload and analyze a new file to compare it against your previous submission.";
    return;
  }

  const overallMeta = deltaMeta(currentResult.overall_score, previousResult.overall_score);
  comparisonMeta.textContent = previousSourceName ? `vs ${previousSourceName}` : "Previous run";
  comparisonSummary.className = `comparison-summary ${overallMeta.direction}`;
  comparisonSummary.innerHTML = `
    <strong>${overallMeta.label}</strong>
    <span>
      Overall moved from ${previousResult.overall_score} to ${currentResult.overall_score}.
      Use this panel to see which dimensions improved after re-upload.
    </span>
  `;
  comparisonList.className = "comparison-list";
  comparisonList.innerHTML = [
    comparisonRow("Overall", currentResult.overall_score, previousResult.overall_score, "overall"),
    comparisonRow(
      "Visual Complexity",
      findDimension(currentResult, "Visual Complexity")?.score ?? 0,
      findDimension(previousResult, "Visual Complexity")?.score ?? 0,
    ),
    comparisonRow(
      "Readability",
      findDimension(currentResult, "Readability")?.score ?? 0,
      findDimension(previousResult, "Readability")?.score ?? 0,
    ),
    comparisonRow(
      "Interaction & Distraction",
      findDimension(currentResult, "Interaction & Distraction")?.score ?? 0,
      findDimension(previousResult, "Interaction & Distraction")?.score ?? 0,
    ),
    comparisonRow(
      "Consistency",
      findDimension(currentResult, "Consistency")?.score ?? 0,
      findDimension(previousResult, "Consistency")?.score ?? 0,
    ),
  ].join("");
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
      : `${issueCount} issues were triggered in this dimension, which means there are visible cognitive load risks to review.`;

    const issues = issueCount
      ? `<ul>${dimension.issues.map((issue) => `
          <li>
            <strong>${escapeHtml(issue.rule_id)}</strong>: ${escapeHtml(issue.description)}
          </li>
        `).join("")}</ul>`
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
  state.sidebarCollapsed = sessionStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  applySidebarState();
  window.addEventListener("resize", applySidebarState);
}

function bindEvents() {
  const printButton = document.getElementById("printReportBtn");
  const assistantForm = document.getElementById("assistantForm");
  const assistantInput = document.getElementById("assistantInput");
  const clearButton = document.getElementById("clearAssistantButton");
  const sidebarToggleButton = document.getElementById("sidebarToggleButton");

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
