import {
  API_BASE,
  escapeHtml,
  fetchJson,
  formatDate,
  saveDashboardSession,
} from "./common.js";

const state = {
  items: [],
  eyeItems: [],
};

let searchRequestToken = 0;
const AUTO_PRINT_STORAGE_KEY = "cognilens.dashboard.autoPrint";

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

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function renderHistoryRows(items, emptyMessage = "No analysis history has been saved yet.") {
  const historyList = document.getElementById("historyList");
  if (!historyList) {
    return;
  }

  if (!items.length) {
    historyList.innerHTML = `<p class="history-empty">${escapeHtml(emptyMessage)}</p>`;
    return;
  }

  historyList.innerHTML = items.map((item) => `
    <article class="history-row">
      <span class="history-cell history-id" title="${escapeHtml(item.run_id)}">${escapeHtml(item.run_id)}</span>
      <span class="history-cell title" title="${escapeHtml(item.source_name)}">${escapeHtml(item.source_name)}</span>
      <span class="history-cell">${escapeHtml(formatDate(item.created_at))}</span>
      <span class="history-cell score">${item.overall_score}</span>
      <span class="history-cell action">
        <div class="history-actions">
          <button class="history-open-btn" type="button" data-run-id="${item.run_id}" data-action="open">View</button>
          <button class="history-print-btn" type="button" data-run-id="${item.run_id}" data-action="print" title="Open this record and print it">
            <span aria-hidden="true">Print</span>
          </button>
        </div>
      </span>
    </article>
  `).join("");
}

function renderEyeHistoryRows(items, emptyMessage = "No eye tracking sessions have been saved yet.") {
  const eyeHistoryList = document.getElementById("eyeHistoryList");
  if (!eyeHistoryList) {
    return;
  }

  if (!items.length) {
    eyeHistoryList.innerHTML = `<p class="history-empty">${escapeHtml(emptyMessage)}</p>`;
    return;
  }

  eyeHistoryList.innerHTML = items.map((item) => {
    const coverage = Number(item.coverage_percent ?? 0).toFixed(1);
    const relatedRun = item.run_id ? escapeHtml(item.run_id) : "&mdash;";
    const targetUrl = item.target_url
      ? `<small title="${escapeHtml(item.target_url)}">${escapeHtml(item.target_url)}</small>`
      : `<small>No target URL saved</small>`;

    return `
      <article class="history-eye-row">
        <span class="history-cell history-id" title="${escapeHtml(item.session_id)}">${escapeHtml(item.session_id)}</span>
        <span class="history-cell history-eye-target">
          <strong title="${escapeHtml(item.source_name)}">${escapeHtml(item.source_name)}</strong>
          ${targetUrl}
        </span>
        <span class="history-cell">${escapeHtml(formatDate(item.created_at))}</span>
        <span class="history-cell score">${coverage}%</span>
        <span class="history-cell">${item.sample_count}</span>
        <span class="history-cell">${escapeHtml(formatDuration(item.duration_ms))}</span>
        <span class="history-cell history-id" title="${item.run_id ? escapeHtml(item.run_id) : ""}">${relatedRun}</span>
      </article>
    `;
  }).join("");
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
  if (button.dataset.action === "print") {
    sessionStorage.setItem(AUTO_PRINT_STORAGE_KEY, "true");
  } else {
    sessionStorage.removeItem(AUTO_PRINT_STORAGE_KEY);
  }
  window.location.href = "./dashboard.html";
}

function applyHistoryFilter() {
  const searchInput = document.getElementById("historySearchInput");
  const query = (searchInput?.value || "").trim().toLowerCase();
  if (!query) {
    renderHistoryRows(state.items);
    renderEyeHistoryRows(state.eyeItems);
    return;
  }

  const filteredItems = state.items.filter((item) =>
    (item.source_name || "").toLowerCase().includes(query)
    || (item.run_id || "").toLowerCase().includes(query)
  );

  const filteredEyeItems = state.eyeItems.filter((item) =>
    (item.source_name || "").toLowerCase().includes(query)
    || (item.session_id || "").toLowerCase().includes(query)
    || (item.run_id || "").toLowerCase().includes(query)
    || (item.target_url || "").toLowerCase().includes(query)
  );

  renderHistoryRows(filteredItems, "No reports match the current file name or ID search.");
  renderEyeHistoryRows(filteredEyeItems, "No eye tracking sessions match the current search.");
}

async function runHistorySearch() {
  const searchInput = document.getElementById("historySearchInput");
  const rawQuery = (searchInput?.value || "").trim();
  const nextToken = ++searchRequestToken;
  const historyList = document.getElementById("historyList");
  const eyeHistoryList = document.getElementById("eyeHistoryList");

  if (historyList) {
    historyList.innerHTML = `<p class="history-empty">Searching analysis history...</p>`;
  }
  if (eyeHistoryList) {
    eyeHistoryList.innerHTML = `<p class="history-empty">Searching eye tracking history...</p>`;
  }

  try {
    const queryParam = rawQuery ? `&query=${encodeURIComponent(rawQuery)}` : "";
    const [historyPayload, eyePayload] = await Promise.all([
      fetchJson(`${API_BASE}/history?limit=20${queryParam}`),
      fetchJson(`${API_BASE}/eye/sessions?limit=20${queryParam}`),
    ]);

    if (nextToken !== searchRequestToken) {
      return;
    }

    state.items = historyPayload.items || [];
    state.eyeItems = eyePayload.items || [];
    applyHistoryFilter();
  } catch (error) {
    if (nextToken !== searchRequestToken) {
      return;
    }
    if (historyList) {
      historyList.innerHTML = `<p class="history-empty">${escapeHtml(error.message)}</p>`;
    }
    if (eyeHistoryList) {
      eyeHistoryList.innerHTML = `<p class="history-empty">${escapeHtml(error.message)}</p>`;
    }
  }
}

function bindHistorySearch() {
  const searchInput = document.getElementById("historySearchInput");
  const searchButton = document.getElementById("historySearchButton");
  if (!searchInput || !searchButton || searchInput.dataset.bound === "true") {
    return;
  }

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runHistorySearch();
    }
  });
  searchButton.addEventListener("click", runHistorySearch);
  searchInput.dataset.bound = "true";
}

async function loadHistory() {
  const historyList = document.getElementById("historyList");
  const eyeHistoryList = document.getElementById("eyeHistoryList");
  if (!historyList || !eyeHistoryList) {
    return;
  }

  try {
    const [historyPayload, eyePayload] = await Promise.all([
      fetchJson(`${API_BASE}/history?limit=20`),
      fetchJson(`${API_BASE}/eye/sessions?limit=20`),
    ]);

    state.items = historyPayload.items || [];
    state.eyeItems = eyePayload.items || [];
    bindHistorySearch();

    renderHistoryRows(state.items);
    renderEyeHistoryRows(state.eyeItems);

    if (historyList.dataset.bound !== "true") {
      historyList.addEventListener("click", handleHistoryClick);
      historyList.dataset.bound = "true";
    }
  } catch (error) {
    historyList.innerHTML = `<p class="history-empty">${escapeHtml(error.message)}</p>`;
    eyeHistoryList.innerHTML = `<p class="history-empty">${escapeHtml(error.message)}</p>`;
  }
}

loadHistory().catch((error) => {
  const historyList = document.getElementById("historyList");
  const eyeHistoryList = document.getElementById("eyeHistoryList");
  if (historyList) {
    historyList.innerHTML = `<p class="history-empty">${escapeHtml(error.message)}</p>`;
  }
  if (eyeHistoryList) {
    eyeHistoryList.innerHTML = `<p class="history-empty">${escapeHtml(error.message)}</p>`;
  }
});
