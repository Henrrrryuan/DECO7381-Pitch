const state = {
  currentHtml: "",
  currentResult: null,
  previousResult: null,
  aiSuggestionEndpoint: null,
};

const samples = {
  simple: "../backend/sample_input/simple-page.html",
  dense: "../backend/sample_input/dense-page.html",
};

async function loadPanelHtml(targetId, path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`无法加载面板：${path}`);
  }
  document.getElementById(targetId).innerHTML = await response.text();
}

function setLoadingState(loading) {
  const analyzeBtn = document.getElementById("analyzeBtn");
  analyzeBtn.disabled = loading;
  analyzeBtn.textContent = loading ? "Analyzing..." : "Analyze";
}

function findDimension(result, name) {
  return result.dimensions.find((dimension) => dimension.dimension === name);
}

function scoreStatus(score) {
  if (score >= 85) return "表现较好";
  if (score >= 70) return "中等风险";
  if (score >= 50) return "需要改进";
  return "高风险";
}

function issueSeverityText(issueCount) {
  if (issueCount === 0) return "当前没有命中规则。";
  if (issueCount === 1) return "当前命中 1 条重点规则。";
  return `当前命中 ${issueCount} 条重点规则。`;
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
    `当前页面总分为 ${overallScore}，整体状态为“${scoreStatus(overallScore)}”。`,
    `最低维度分为 ${result.min_dimension_score}，说明短板维度已经开始明显影响整体体验。`,
    readability
      ? `Readability 当前得分为 ${readability.score}。${issueSeverityText(readability.issues.length)}`
      : "Readability 结果暂不可用。",
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
      <strong>${previous} → ${current}</strong>
      <em>${deltaLabel}</em>
    </div>
  `;
}

function renderComparison(result) {
  const comparisonPanel = document.getElementById("comparisonPanel");
  if (!state.previousResult) {
    comparisonPanel.className = "comparison-panel empty";
    comparisonPanel.textContent = "还没有前后对比数据。再次分析新的 HTML 后，这里会显示差异。";
    return;
  }

  comparisonPanel.className = "comparison-panel";
  comparisonPanel.innerHTML = `
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

function renderExplanation(result) {
  const explanationContent = document.getElementById("explanationContent");
  const blocks = result.dimensions.map((dimension) => {
    const issueCount = dimension.issues.length;
    const summary =
      issueCount === 0
        ? "当前未命中规则，说明这一维度暂时没有显著风险。"
        : `当前命中 ${issueCount} 条规则，说明这一维度存在可见的认知负担来源。`;

    const issues = issueCount
      ? `<ul>${dimension.issues
          .map(
            (issue) =>
              `<li><strong>${issue.rule_id}</strong>：${issue.description}</li>`,
          )
          .join("")}</ul>`
      : "";

    return `
      <section class="explanation-block">
        <h3>${dimension.dimension}（Score: ${dimension.score}）</h3>
        <p>${summary}</p>
        ${issues}
      </section>
    `;
  });

  explanationContent.className = "rich-text";
  explanationContent.innerHTML = blocks.join("");
}

function renderSuggestions(result) {
  const suggestionContent = document.getElementById("suggestionContent");
  const readability = findDimension(result, "Readability");
  const suggestions = [];

  if (readability) {
    readability.issues.forEach((issue) => {
      suggestions.push(`
        <article class="suggestion-bubble system">
          <p><strong>${issue.rule_id}</strong>：${issue.suggestion}</p>
          <p class="subtle">原因：${issue.description}</p>
        </article>
      `);
    });
  }

  if (!suggestions.length) {
    suggestions.push(`
      <article class="suggestion-bubble system">
        <p>当前没有 Readability 命中问题，可继续测试其他 HTML 或等待其他维度接入。</p>
      </article>
    `);
  }

  suggestions.push(`
    <article class="suggestion-bubble ai-placeholder">
      <p><strong>AI API 接口预留</strong></p>
      <p>后期可在这里调用 \`requestAiSuggestion(context)\`，根据当前分析结果生成更细的解释或修改建议。</p>
    </article>
  `);

  suggestionContent.innerHTML = suggestions.join("");
}

function renderPreviewContent() {
  const previewFrame = document.getElementById("previewFrame");
  const previewCode = document.getElementById("previewCode");
  previewFrame.srcdoc = state.currentHtml || "<p>还没有可预览的 HTML。</p>";
  previewCode.textContent = state.currentHtml || "还没有可预览的 HTML。";
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
}

async function fetchSample(sampleName) {
  const response = await fetch(samples[sampleName]);
  if (!response.ok) {
    throw new Error(`无法读取 sample: ${sampleName}`);
  }
  const html = await response.text();
  document.getElementById("htmlInput").value = html;
  state.currentHtml = html;
}

async function analyzeHtml() {
  const htmlInput = document.getElementById("htmlInput");
  const html = htmlInput.value.trim();
  const apiBase = document.getElementById("apiBase").value.trim();

  if (!html) {
    alert("请先输入或载入 HTML。");
    return;
  }

  setLoadingState(true);
  try {
    const response = await fetch(`${apiBase}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html }),
    });

    if (!response.ok) {
      throw new Error(`后端请求失败：${response.status}`);
    }

    const result = await response.json();
    if (state.currentResult) {
      state.previousResult = state.currentResult;
    }
    state.currentHtml = html;
    renderResult(result);
  } catch (error) {
    document.getElementById("explanationContent").className = "rich-text empty";
    document.getElementById("explanationContent").textContent = String(error);
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
  document.getElementById("loadSimpleBtn").addEventListener("click", () => {
    fetchSample("simple").catch((error) => {
      document.getElementById("explanationContent").textContent = String(error);
    });
  });

  document.getElementById("loadDenseBtn").addEventListener("click", () => {
    fetchSample("dense").catch((error) => {
      document.getElementById("explanationContent").textContent = String(error);
    });
  });

  document.getElementById("fileInput").addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    const html = await file.text();
    document.getElementById("htmlInput").value = html;
    state.currentHtml = html;
  });

  document.getElementById("analyzeBtn").addEventListener("click", analyzeHtml);

  document.getElementById("reuploadBtn").addEventListener("click", () => {
    document.getElementById("fileInput").click();
  });

  document.getElementById("openPreviewBtn").addEventListener("click", openPreviewModal);
  document.getElementById("closePreviewBtn").addEventListener("click", closePreviewModal);
  document.getElementById("previewRenderedTab").addEventListener("click", () => {
    switchPreviewTab("rendered");
  });
  document.getElementById("previewCodeTab").addEventListener("click", () => {
    switchPreviewTab("code");
  });

  document.getElementById("previewOverlay").addEventListener("click", (event) => {
    if (event.target.id === "previewOverlay") {
      closePreviewModal();
    }
  });

  document.getElementById("suggestionForm").addEventListener("submit", (event) => {
    event.preventDefault();
  });
}

async function requestAiSuggestion(context) {
  if (!state.aiSuggestionEndpoint) {
    return {
      status: "placeholder",
      message: "AI API 还未接入。后期可以在这里调用真实接口。",
      context,
    };
  }

  const response = await fetch(state.aiSuggestionEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(context),
  });

  if (!response.ok) {
    throw new Error(`AI suggestion 请求失败：${response.status}`);
  }

  return response.json();
}

async function init() {
  await Promise.all([
    loadPanelHtml("leftPanelMount", "./components/dashboard-panel.html"),
    loadPanelHtml("rightPanelMount", "./components/insights-panel.html"),
  ]);

  bindEvents();
  switchPreviewTab("rendered");
  await fetchSample("dense").catch(() => {});
}

init().catch((error) => {
  document.body.innerHTML = `<pre style="padding: 24px;">${String(error)}</pre>`;
});
