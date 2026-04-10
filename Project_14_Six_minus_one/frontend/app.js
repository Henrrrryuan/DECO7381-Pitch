import {
  buildAnalysisView,
  escapeHtml,
  findDimension,
  loadDashboardSession,
} from "./common.js";

const state = {
  currentHtml: "",
  currentResult: null,
};

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

function renderSuggestions(result) {
  const suggestionContent = document.getElementById("suggestionContent");
  if (!suggestionContent) {
    return;
  }

  const sections = [];

  result.dimensions.forEach((dimension) => {
    if (!dimension.issues.length) {
      return;
    }

    sections.push(`
      <section class="suggestion-group">
        <h3>${escapeHtml(dimension.dimension)}</h3>
        ${dimension.issues.map((issue) => `
          <article class="suggestion-bubble system">
            <p><strong>${escapeHtml(issue.rule_id)}</strong>: ${escapeHtml(issue.suggestion)}</p>
            <p class="subtle">Why it matters: ${escapeHtml(issue.description)}</p>
          </article>
        `).join("")}
      </section>
    `);
  });

  if (!sections.length) {
    sections.push(`
      <article class="suggestion-bubble system">
        <p>No rules were triggered in the current run. Upload another HTML page to inspect more complex cases.</p>
      </article>
    `);
  }

  sections.push(`
    <article class="suggestion-bubble ai-placeholder">
      <p><strong>AI API placeholder</strong></p>
      <p>Later, this area can call a dedicated AI endpoint to generate richer rewrite suggestions or explanation text.</p>
    </article>
  `);

  suggestionContent.innerHTML = sections.join("");
}

function renderResult(result, html) {
  state.currentResult = result;
  state.currentHtml = html || "";
  renderScoreRing(result.overall_score);
  renderDimensionBars(result);
  renderDashboardSummary(result);
  renderExplanation(result);
  renderSuggestions(result);
}

function bindEvents() {
  const printButton = document.getElementById("printReportBtn");
  if (printButton) {
    printButton.addEventListener("click", () => {
      window.print();
    });
  }
}

async function init() {
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
  if (sourceNode) {
    sourceNode.textContent = currentSession.sourceName || currentSession.payload?.run?.source_name || "Uploaded file";
  }

  renderResult(
    currentResult,
    currentSession.html || currentSession.payload.html_content || "",
  );
  renderComparison(currentResult, previousResult, previousSession?.sourceName || "");
}

init().catch((error) => {
  document.body.innerHTML = `<pre style="padding:24px;">${escapeHtml(String(error))}</pre>`;
});
