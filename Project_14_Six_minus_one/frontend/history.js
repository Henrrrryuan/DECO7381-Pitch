import {
  API_BASE,
  escapeHtml,
  fetchJson,
  formatDate,
  saveDashboardSession,
} from "./common.js";

const state = {
  items: [],
};

let searchRequestToken = 0;

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

function renderHistoryRows(items) {
  const historyList = document.getElementById("historyList");
  if (!historyList) {
    return;
  }

  if (!items.length) {
    historyList.innerHTML = `<p class="history-empty">No reports match the current file name search.</p>`;
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
}

function applyHistoryFilter() {
  const searchInput = document.getElementById("historySearchInput");
  const query = (searchInput?.value || "").trim().toLowerCase();
  if (!query) {
    renderHistoryRows(state.items);
    return;
  }

  const filteredItems = state.items.filter((item) =>
    (item.source_name || "").toLowerCase().includes(query)
  );
  renderHistoryRows(filteredItems);
}

async function runHistorySearch() {
  const searchInput = document.getElementById("historySearchInput");
  const rawQuery = (searchInput?.value || "").trim();
  const nextToken = ++searchRequestToken;
  const historyList = document.getElementById("historyList");

  if (historyList) {
    historyList.innerHTML = `<p class="history-empty">Searching history...</p>`;
  }

  try {
    const queryParam = rawQuery ? `&query=${encodeURIComponent(rawQuery)}` : "";
    const payload = await fetchJson(`${API_BASE}/history?limit=20${queryParam}`);
    if (nextToken !== searchRequestToken) {
      return;
    }

    state.items = payload.items || [];
    if (!rawQuery) {
      renderHistoryRows(state.items);
      return;
    }

    applyHistoryFilter();
  } catch (error) {
    if (nextToken !== searchRequestToken) {
      return;
    }
    if (historyList) {
      historyList.innerHTML = `<p class="history-empty">${escapeHtml(error.message)}</p>`;
    }
  }
}

function bindHistorySearch() {
  const searchInput = document.getElementById("historySearchInput");
  const searchButton = document.getElementById("historySearchButton");
  if (!searchInput || !searchButton || searchInput.dataset.bound === "true") {
    return;
  }

  searchInput.addEventListener("input", runHistorySearch);
  searchButton.addEventListener("click", runHistorySearch);
  searchInput.dataset.bound = "true";
}

async function loadHistory() {
  const historyList = document.getElementById("historyList");
  if (!historyList) {
    return;
  }

  try {
    const payload = await fetchJson(`${API_BASE}/history?limit=20`);
    const items = payload.items || [];
    state.items = items;
    bindHistorySearch();

    if (!items.length) {
      historyList.innerHTML = `<p class="history-empty">No analysis history has been saved yet.</p>`;
      return;
    }

    renderHistoryRows(items);
    if (historyList.dataset.bound !== "true") {
      historyList.addEventListener("click", handleHistoryClick);
      historyList.dataset.bound = "true";
    }
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
