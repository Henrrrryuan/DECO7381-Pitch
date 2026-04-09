import {
  API_BASE,
  escapeHtml,
  fetchJson,
  formatDate,
  saveDashboardSession,
} from "./common.js";

function buildCurrentSession(detail) {
  return {
    current: {
      payload: detail.analysis,
      html: detail.html_content || "",
      sourceName: detail.run?.source_name || "history-item",
      savedAt: detail.run?.created_at || new Date().toISOString(),
    },
    previous: null,
  };
}

async function handleHistoryClick(event) {
  const button = event.target.closest("[data-run-id]");
  if (!button) {
    return;
  }

  const runId = button.dataset.runId;
  if (!runId) {
    return;
  }

  const detail = await fetchJson(`${API_BASE}/history/${runId}`);
  saveDashboardSession(buildCurrentSession(detail));
  window.location.href = "./dashboard.html";
}

async function loadHistory() {
  const historyList = document.getElementById("historyList");
  if (!historyList) {
    return;
  }

  try {
    const payload = await fetchJson(`${API_BASE}/history?limit=20`);
    const items = payload.items || [];

    if (!items.length) {
      historyList.innerHTML = `<p class="history-empty">No analysis history has been saved yet.</p>`;
      return;
    }

    historyList.innerHTML = items.map((item) => `
      <article class="history-row">
        <span class="history-cell title" title="${escapeHtml(item.source_name)}">${escapeHtml(item.source_name)}</span>
        <span class="history-cell">${escapeHtml(formatDate(item.created_at))}</span>
        <span class="history-cell score">${item.overall_score}</span>
        <span class="history-cell action">
          <button class="history-open-btn" type="button" data-run-id="${item.run_id}">Open</button>
        </span>
      </article>
    `).join("");

    historyList.addEventListener("click", handleHistoryClick);
  } catch (error) {
    historyList.innerHTML = `<p class="history-empty">${escapeHtml(error.message)}</p>`;
  }
}

loadHistory().catch((error) => {
  const historyList = document.getElementById("historyList");
  if (historyList) {
    historyList.innerHTML = `<p class="history-empty">${escapeHtml(error.message)}</p>`;
  }
});
