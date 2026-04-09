const state = {
  currentHtml: "",
  currentResult: null,
  currentRun: null,
  previousResult: null,
  previousRun: null,
  baselineRunId: null,
  baselineResult: null,
  baselineRun: null,
  historyItems: [],
  aiSuggestionEndpoint: null,
  selectedFile: null,
  currentSourceName: "Manual HTML",
};

const samples = {
  simple: {
    apiName: "simple",
    sourceName: "simple-page.html",
  },
  dense: {
    apiName: "dense",
    sourceName: "dense-page.html",
  },
  consistency: {
    apiName: "consistency",
    sourceName: "consistency-combined.html",
  },
};

async function loadPanelHtml(targetId, path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load panel: ${path}`);
  }
  document.getElementById(targetId).innerHTML = await response.text();
}

function getApiBase() {
  return document.getElementById("apiBase").value.trim() || "http://127.0.0.1:8001";
}

function setApiStatus(message) {
  const statusNode = document.getElementById("apiStatus");
  if (statusNode) {
    statusNode.textContent = message;
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.detail) {
        detail = payload.detail;
      }
    } catch (error) {
      // Ignore JSON parsing errors and fall back to the status text.
    }
    throw new Error(detail);
  }
  return response.json();
}

async function checkBackendHealth() {
  try {
    await fetchJson(`${getApiBase()}/health`);
    setApiStatus("Backend status: connected");
  } catch (error) {
    setApiStatus(`Backend status: ${error.message}`);
  }
}

function getFileExtension(fileName) {
  const index = fileName.lastIndexOf(".");
  if (index < 0) return "";
  return fileName.slice(index).toLowerCase();
}

function isZipFile(file) {
  return getFileExtension(file?.name || "") === ".zip";
}

function isHtmlFile(file) {
  return [".html", ".htm"].includes(getFileExtension(file?.name || ""));
}

function setLoadingState(loading) {
  const analyzeBtn = document.getElementById("analyzeBtn");
  analyzeBtn.disabled = loading;
  analyzeBtn.textContent = loading ? "Analyzing..." : "Analyze";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function findDimension(result, name) {
  return result?.dimensions?.find((dimension) => dimension.dimension === name);
}

function scoreStatus(score) {
  if (score >= 85) return "Strong";
  if (score >= 70) return "Moderate risk";
  if (score >= 50) return "Needs work";
  return "High risk";
}

function issueSeverityText(issueCount) {
  if (issueCount === 0) return "No rules were triggered.";
  if (issueCount === 1) return "1 rule is currently triggered.";
  return `${issueCount} rules are currently triggered.`;
}

function formatDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function normalizeAnalysisPayload(payload, fallbackHtml) {
  return {
    analysis: {
      overall_score: payload.overall_score,
      weighted_average: payload.weighted_average,
      min_dimension_score: payload.min_dimension_score,
      dimensions: payload.dimensions || [],
    },
    run: payload.run || null,
    htmlContent: payload.html_content || fallbackHtml || "",
    baselineRunId: payload.baseline_run_id || null,
  };
}

function setComparisonBaseline(run, analysis) {
  state.baselineRunId = run?.run_id || null;
  state.baselineRun = run || null;
  state.baselineResult = analysis || null;

  if (
    state.currentResult &&
    state.baselineResult &&
    state.currentRun &&
    state.currentRun.run_id !== state.baselineRunId
  ) {
    state.previousRun = state.baselineRun;
    state.previousResult = state.baselineResult;
  } else if (state.baselineRunId && state.currentRun?.run_id === state.baselineRunId) {
    state.previousRun = null;
    state.previousResult = null;
  }
}

function clearComparisonBaseline() {
  state.baselineRunId = null;
  state.baselineRun = null;
  state.baselineResult = null;
  state.previousRun = null;
  state.previousResult = null;
  renderHistory();
  renderComparison(state.currentResult);
}

function renderScoreRing(score) {
  const scoreRing = document.getElementById("scoreRing");
  const leftOverallScore = document.getElementById("leftOverallScore");
  leftOverallScore.textContent = score;
  scoreRing.style.setProperty("--score", `${score}`);
}

function renderDimensionBars(result) {
  const dimensionBars = document.getElementById("dimensionBars");
  const config = [
    { name: "Visual Complexity", className: "visual" },
    { name: "Readability", className: "readability" },
    { name: "Interaction & Distraction", className: "interaction" },
    { name: "Consistency", className: "consistency" },
  ];

  dimensionBars.innerHTML = config
    .map(({ name, className }) => {
      const dimension = findDimension(result, name);
      const score = dimension ? dimension.score : 0;
      return `
        <div class="dimension-row">
          <span>${name}</span>
          <div class="bar-track">
            <div class="bar-fill ${className}" style="width:${score}%"></div>
          </div>
          <strong>${score}</strong>
        </div>
      `;
    })
    .join("");
}

function renderOverallComments(result) {
  const overallComments = document.getElementById("overallComments");
  const readability = findDimension(result, "Readability");
  const overallScore = result.overall_score;
  const comment = [
    `The current page scores ${overallScore}, which places it in the "${scoreStatus(overallScore)}" band.`,
    `The lowest dimension score is ${result.min_dimension_score}, so the weakest area is already pulling down the overall experience.`,
    readability
      ? `Readability is currently ${readability.score}. ${issueSeverityText(readability.issues.length)}`
      : "Readability details are not available yet.",
  ].join(" ");

  overallComments.textContent = comment;
  document.getElementById("dashboardStatus").textContent = scoreStatus(overallScore);
  document.getElementById("dashboardSummaryText").textContent = comment;
}

function comparisonLine(label, current, previous) {
  const delta = current - previous;
  const deltaLabel = delta === 0 ? "0" : `${delta > 0 ? "+" : ""}${delta}`;
  const trendClass = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return `
    <div class="comparison-row ${trendClass}">
      <span>${label}</span>
      <strong>${previous} to ${current}</strong>
      <em>${deltaLabel}</em>
    </div>
  `;
}

function renderComparison(result) {
  const comparisonPanel = document.getElementById("comparisonPanel");
  if (!result || !state.previousResult) {
    comparisonPanel.className = "comparison-panel empty";
    comparisonPanel.textContent =
      "Analyze a new page or choose a history baseline to see score deltas here.";
    return;
  }

  const comparisonLabel = state.previousRun
    ? `Comparing against ${escapeHtml(state.previousRun.source_name)}`
    : "Comparing against the previous analysis";

  comparisonPanel.className = "comparison-panel";
  comparisonPanel.innerHTML = `
    <p class="comparison-caption subtle">${comparisonLabel}</p>
    ${comparisonLine("Overall Score", result.overall_score, state.previousResult.overall_score)}
    ${comparisonLine(
      "Readability",
      findDimension(result, "Readability")?.score ?? 0,
      findDimension(state.previousResult, "Readability")?.score ?? 0,
    )}
    ${comparisonLine(
      "Weighted Average",
      result.weighted_average,
      state.previousResult.weighted_average,
    )}
  `;
}

const severityOrder = {
  critical: 0,
  major: 1,
  minor: 2,
};

function sortIssuesBySeverity(issues) {
  return [...issues].sort((left, right) => {
    const leftRank = severityOrder[left.severity] ?? 99;
    const rightRank = severityOrder[right.severity] ?? 99;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.rule_id.localeCompare(right.rule_id);
  });
}

function severityLabel(severity) {
  if (severity === "critical") return "Critical";
  if (severity === "major") return "Major";
  return "Minor";
}

function renderExplanation(result) {
  const explanationContent = document.getElementById("explanationContent");
  const blocks = result.dimensions.map((dimension) => {
    const issueCount = dimension.issues.length;
    const sortedIssues = sortIssuesBySeverity(dimension.issues);
    const summary =
      issueCount === 0
        ? "No high-priority issues were triggered in this dimension for the current analysis."
        : `${issueCount} issues were triggered in this dimension, which means there are visible cognitive load risks to review.`;

    const issues = issueCount
      ? `<div class="issue-list">${sortedIssues
          .map(
            (issue) => `
              <article class="issue-item">
                <div class="issue-item-top">
                  <strong>${escapeHtml(issue.rule_id)}</strong>
                  <span class="severity-badge severity-${escapeHtml(issue.severity)}">${severityLabel(issue.severity)}</span>
                </div>
                <p>${escapeHtml(issue.description)}</p>
              </article>
            `,
          )
          .join("")}</div>`
      : `<p class="issue-empty subtle">This dimension did not trigger any rules in the current run.</p>`;

    return `
      <section class="explanation-block">
        <div class="explanation-head">
          <h3>${escapeHtml(dimension.dimension)}</h3>
          <div class="explanation-meta">
            <span class="metric-pill">Score ${dimension.score}</span>
            <span class="metric-pill">${issueCount} issue${issueCount === 1 ? "" : "s"}</span>
          </div>
        </div>
        <p class="explanation-summary">${escapeHtml(summary)}</p>
        ${issues}
      </section>
    `;
  });

  explanationContent.className = "rich-text";
  explanationContent.innerHTML = blocks.join("");
}

function renderSuggestions(result) {
  const suggestionContent = document.getElementById("suggestionContent");
  const issueCount = result.dimensions.reduce(
    (count, dimension) => count + dimension.issues.length,
    0,
  );

  suggestionContent.innerHTML = `
    <article class="suggestion-bubble ai-placeholder">
      <p><strong>AI Suggestion Placeholder</strong></p>
      <p>This section is reserved for a later AI API integration.</p>
      <p class="subtle">Current analysis has detected ${issueCount} rule-triggered issue${issueCount === 1 ? "" : "s"} across the four dimensions. A future AI service can use this context to generate rewrite suggestions, prioritised fixes, or clearer implementation guidance.</p>
    </article>
  `;
}

function renderPreviewContent() {
  const previewFrame = document.getElementById("previewFrame");
  const previewCode = document.getElementById("previewCode");
  previewFrame.srcdoc = state.currentHtml || "<p>No HTML preview is available yet.</p>";
  previewCode.textContent = state.currentHtml || "No HTML preview is available yet.";
}

function renderHistory(emptyMessage = "Analysis history will appear here after you run the analyzer.") {
  const historyList = document.getElementById("historyList");
  const historyMeta = document.getElementById("historyMeta");
  const historyBaselineText = document.getElementById("historyBaselineText");
  const clearBaselineBtn = document.getElementById("clearBaselineBtn");

  if (!historyList || !historyMeta || !historyBaselineText || !clearBaselineBtn) {
    return;
  }

  historyMeta.textContent = state.historyItems.length
    ? `Recent ${state.historyItems.length}`
    : "No records";

  if (state.baselineRun) {
    historyBaselineText.textContent = `Baseline: ${state.baselineRun.source_name}`;
    clearBaselineBtn.classList.remove("hidden");
  } else {
    historyBaselineText.textContent = "No comparison baseline selected.";
    clearBaselineBtn.classList.add("hidden");
  }

  if (!state.historyItems.length) {
    historyList.className = "history-list empty";
    historyList.textContent = emptyMessage;
    return;
  }

  historyList.className = "history-list";
  historyList.innerHTML = state.historyItems
    .map((item) => {
      const isCurrent = state.currentRun?.run_id === item.run_id;
      const isBaseline = state.baselineRunId === item.run_id;
      const itemClasses = [
        "history-item",
        isCurrent ? "current" : "",
        isBaseline ? "baseline" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const baselineLabel = isBaseline ? "Current baseline" : "Set baseline";
      return `
        <article class="${itemClasses}">
          <div class="history-item-top">
            <strong class="history-item-title" title="${escapeHtml(item.source_name)}">${escapeHtml(item.source_name)}</strong>
            <span class="history-score">${item.overall_score}</span>
          </div>
          <p class="history-meta">${escapeHtml(formatDate(item.created_at))}</p>
          <div class="history-actions">
            <button class="history-btn" type="button" data-action="view" data-run-id="${item.run_id}">View</button>
            <button
              class="history-btn ${isBaseline ? "active" : ""}"
              type="button"
              data-action="baseline"
              data-run-id="${item.run_id}"
              ${isBaseline ? "disabled" : ""}
            >${baselineLabel}</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderResult(result) {
  state.currentResult = result;
  renderScoreRing(result.overall_score);
  renderDimensionBars(result);
  renderOverallComments(result);
  renderComparison(result);
  renderExplanation(result);
  renderSuggestions(result);
  renderPreviewContent();
  renderHistory();
}

function showInlineError(error) {
  const explanationContent = document.getElementById("explanationContent");
  explanationContent.className = "rich-text empty";
  explanationContent.textContent = String(error);
}

async function fetchSample(sampleName) {
  const sample = samples[sampleName];
  const payload = await fetchJson(`${getApiBase()}/samples/${sample.apiName}`, {
    cache: "no-store",
  });
  const html = payload.html;
  document.getElementById("htmlInput").value = html;
  document.getElementById("fileInput").value = "";
  state.selectedFile = null;
  state.currentHtml = html;
  state.currentSourceName = payload.source_name || sample.sourceName;
}

async function loadHistory() {
  try {
    const payload = await fetchJson(`${getApiBase()}/history?limit=8`);
    state.historyItems = payload.items || [];
    renderHistory();
    setApiStatus("Backend status: connected");
  } catch (error) {
    state.historyItems = [];
    renderHistory("History is unavailable until the backend is reachable.");
    setApiStatus(`Backend status: ${error.message}`);
  }
}

async function loadHistoryRun(runId) {
  const payload = await fetchJson(`${getApiBase()}/history/${runId}`);
  const analysis = payload.analysis;
  const run = payload.run;
  const htmlContent = payload.html_content || "";

  state.currentRun = run;
  state.currentResult = analysis;
  state.currentHtml = htmlContent;
  state.currentSourceName = run.source_name;
  state.selectedFile = null;
  document.getElementById("fileInput").value = "";
  document.getElementById("htmlInput").value = htmlContent;

  if (state.baselineRunId && state.baselineResult && state.baselineRunId !== run.run_id) {
    state.previousRun = state.baselineRun;
    state.previousResult = state.baselineResult;
  } else {
    state.previousRun = null;
    state.previousResult = null;
  }

  renderResult(analysis);
}

async function setHistoryBaseline(runId) {
  const payload = await fetchJson(`${getApiBase()}/history/${runId}`);
  setComparisonBaseline(payload.run, payload.analysis);
  renderHistory();
  renderComparison(state.currentResult);
}

async function requestAnalyzeResult(apiBase, html, selectedFile) {
  if (selectedFile && isZipFile(selectedFile)) {
    const formData = new FormData();
    formData.append("file", selectedFile);
    if (state.baselineRunId) {
      formData.append("baseline_run_id", state.baselineRunId);
    }

    return fetchJson(`${apiBase}/analyze-zip`, {
      method: "POST",
      body: formData,
    });
  }

  return fetchJson(`${apiBase}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      source_name: state.currentSourceName,
      baseline_run_id: state.baselineRunId,
    }),
  });
}

async function analyzeHtml() {
  const htmlInput = document.getElementById("htmlInput");
  const html = htmlInput.value.trim();
  const apiBase = getApiBase();
  const selectedFile = state.selectedFile;
  const useZipUpload = selectedFile && isZipFile(selectedFile);

  if (!useZipUpload && !html) {
    alert("Load HTML or choose a ZIP file before running analysis.");
    return;
  }

  setLoadingState(true);
  try {
    const payload = await requestAnalyzeResult(apiBase, html, selectedFile);
    const response = normalizeAnalysisPayload(
      payload,
      useZipUpload ? state.currentHtml : html,
    );

    if (
      state.baselineRunId &&
      state.baselineResult &&
      response.run?.run_id !== state.baselineRunId
    ) {
      state.previousRun = state.baselineRun;
      state.previousResult = state.baselineResult;
    } else if (state.currentResult) {
      state.previousRun = state.currentRun;
      state.previousResult = state.currentResult;
    } else {
      state.previousRun = null;
      state.previousResult = null;
    }

    state.currentRun = response.run;
    state.currentResult = response.analysis;
    state.currentHtml = response.htmlContent;
    state.currentSourceName = response.run?.source_name || state.currentSourceName;
    document.getElementById("htmlInput").value = response.htmlContent;

    renderResult(response.analysis);
    await loadHistory();
  } catch (error) {
    showInlineError(error);
  } finally {
    setLoadingState(false);
  }
}

function openPreviewModal() {
  renderPreviewContent();
  document.getElementById("previewOverlay").classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closePreviewModal() {
  document.getElementById("previewOverlay").classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function switchPreviewTab(mode) {
  const frame = document.getElementById("previewFrame");
  const code = document.getElementById("previewCode");
  const renderedBtn = document.getElementById("previewRenderedTab");
  const codeBtn = document.getElementById("previewCodeTab");

  const renderedMode = mode === "rendered";
  frame.classList.toggle("hidden", !renderedMode);
  code.classList.toggle("hidden", renderedMode);
  renderedBtn.classList.toggle("active", renderedMode);
  codeBtn.classList.toggle("active", !renderedMode);
}

function bindEvents() {
  bindEvent("loadSimpleBtn", "click", () => {
    fetchSample("simple").catch(showInlineError);
  });

  bindEvent("loadDenseBtn", "click", () => {
    fetchSample("dense").catch(showInlineError);
  });

  bindEvent("loadConsistencyBtn", "click", () => {
    fetchSample("consistency").catch(showInlineError);
  });

  bindEvent("fileInput", "change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;

    if (isZipFile(file)) {
      state.selectedFile = file;
      state.currentSourceName = file.name;
      state.currentHtml = `<!-- ZIP: ${file.name} -->`;
      document.getElementById("htmlInput").value =
        `<!-- Selected ZIP file: ${file.name} -->\n<!-- Click Analyze to send it to /analyze-zip -->`;
      return;
    }

    if (isHtmlFile(file)) {
      const html = await file.text();
      state.selectedFile = null;
      state.currentSourceName = file.name;
      document.getElementById("htmlInput").value = html;
      state.currentHtml = html;
      return;
    }

    state.selectedFile = null;
    event.target.value = "";
    alert("Only HTML and ZIP uploads are supported.");
  });

  bindEvent("htmlInput", "input", (event) => {
    if (state.selectedFile) {
      state.selectedFile = null;
      document.getElementById("fileInput").value = "";
    }
    state.currentHtml = event.target.value;
  });

  bindEvent("analyzeBtn", "click", analyzeHtml);

  bindEvent("reuploadBtn", "click", () => {
    document.getElementById("fileInput").click();
  });

  bindEvent("clearBaselineBtn", "click", () => {
    clearComparisonBaseline();
  });

  bindEvent("historyList", "click", (event) => {
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) {
      return;
    }

    const runId = actionTarget.dataset.runId;
    if (!runId) {
      return;
    }

    if (actionTarget.dataset.action === "view") {
      loadHistoryRun(runId).catch(showInlineError);
      return;
    }

    if (actionTarget.dataset.action === "baseline") {
      setHistoryBaseline(runId).catch(showInlineError);
    }
  });

  bindEvent("openPreviewBtn", "click", openPreviewModal);
  bindEvent("closePreviewBtn", "click", closePreviewModal);
  bindEvent("previewRenderedTab", "click", () => {
    switchPreviewTab("rendered");
  });
  bindEvent("previewCodeTab", "click", () => {
    switchPreviewTab("code");
  });

  bindEvent("previewOverlay", "click", (event) => {
    if (event.target.id === "previewOverlay") {
      closePreviewModal();
    }
  });

  bindEvent("suggestionForm", "submit", (event) => {
    event.preventDefault();
  });

  bindEvent("apiBase", "change", () => {
    checkBackendHealth();
    loadHistory();
  });
}

function bindEvent(elementId, eventName, handler) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`Missing element for event binding: ${elementId}`);
    return;
  }
  element.addEventListener(eventName, handler);
}

async function requestAiSuggestion(context) {
  if (!state.aiSuggestionEndpoint) {
    return {
      status: "placeholder",
      message: "AI API is not connected yet. This is a placeholder response.",
      context,
    };
  }

  return fetchJson(state.aiSuggestionEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(context),
  });
}

async function init() {
  await Promise.all([
    loadPanelHtml("leftPanelMount", "./components/dashboard-panel.html"),
    loadPanelHtml("rightPanelMount", "./components/insights-panel.html"),
  ]);

  bindEvents();
  switchPreviewTab("rendered");
  await Promise.all([
    checkBackendHealth(),
    loadHistory(),
    fetchSample("dense").catch(() => {}),
  ]);
}

init().catch((error) => {
  document.body.innerHTML = `<pre style="padding: 24px;">${escapeHtml(String(error))}</pre>`;
});
