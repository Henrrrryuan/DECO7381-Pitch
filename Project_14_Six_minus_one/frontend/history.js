import {
  API_BASE,
  escapeHtml,
  fetchJson,
  formatDate,
  formatShortId,
  saveDashboardSession,
} from "./common.js";

const state = {
  items: [],
  eyeItems: [],
  historyTotal: 0,
  eyeTotal: 0,
  historyPage: 1,
  eyePage: 1,
  query: "",
};

let searchRequestToken = 0;
const PAGE_SIZE = 25;
const AUTO_PRINT_STORAGE_KEY = "cognilens.dashboard.autoPrint";

function buildCurrentSession(detail) {
  const sourceName = detail.run?.source_name || "history-item";
  const sourceUrl = /^https?:\/\//i.test(sourceName) ? sourceName : "";
  return {
    current: {
      payload: {
        ...detail.analysis,
        run: detail.run,
      },
      html: detail.html_content || "",
      sourceName,
      sourceUrl,
      savedAt: detail.run?.created_at || new Date().toISOString(),
    },
    previous: null,
    sourceUrl,
  };
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function getTotalPages(total) {
  return Math.max(1, Math.ceil((Number(total) || 0) / PAGE_SIZE));
}

function getPageOffset(page) {
  return (Math.max(1, Number(page) || 1) - 1) * PAGE_SIZE;
}

function buildPagedUrl(path, page) {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(getPageOffset(page)),
  });

  if (state.query) {
    params.set("query", state.query);
  }

  return `${API_BASE}${path}?${params.toString()}`;
}

function renderPagination({
  containerId,
  page,
  total,
  kind,
  itemLabel,
}) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  const totalPages = getTotalPages(total);
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const startItem = total ? getPageOffset(safePage) + 1 : 0;
  const endItem = Math.min(getPageOffset(safePage) + PAGE_SIZE, total);

  container.innerHTML = `
    <div class="history-pagination-summary">
      <strong>Page ${safePage} of ${totalPages}</strong>
      <span>${startItem}-${endItem} of ${total} ${escapeHtml(itemLabel)}</span>
    </div>
    <div class="history-pagination-controls" data-pagination-kind="${kind}">
      <button class="history-page-btn" type="button" data-page-action="previous" ${safePage <= 1 ? "disabled" : ""}>Previous</button>
      <label class="history-page-jump">
        <span>Go to</span>
        <input class="history-page-input" type="number" min="1" max="${totalPages}" value="${safePage}" inputmode="numeric">
      </label>
      <button class="history-page-btn" type="button" data-page-action="jump">Go</button>
      <button class="history-page-btn" type="button" data-page-action="next" ${safePage >= totalPages ? "disabled" : ""}>Next</button>
    </div>
  `;
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
      <span class="history-cell history-id" title="${escapeHtml(item.run_id)}">${escapeHtml(formatShortId(item.run_id, "R-"))}</span>
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

function renderEyeHistoryRows(items, emptyMessage = "No eye-tracking evidence sessions have been saved yet.") {
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
    const relatedRun = item.run_id ? escapeHtml(formatShortId(item.run_id, "R-")) : "&mdash;";
    const sessionMeta = `${escapeHtml(formatDate(item.created_at))} / ${item.sample_count} samples / ${escapeHtml(formatDuration(item.duration_ms))}`;
    const targetUrl = item.target_url
      ? `<small title="${escapeHtml(item.target_url)}">${escapeHtml(item.target_url)}</small>`
      : `<small>No target URL saved</small>`;

    return `
      <article class="history-eye-row">
        <span class="history-cell history-id" title="${escapeHtml(item.session_id)}">${escapeHtml(formatShortId(item.session_id, "E-"))}</span>
        <span class="history-cell history-eye-target">
          <strong title="${escapeHtml(item.source_name)}">${escapeHtml(item.source_name)}</strong>
          ${targetUrl}
          <small>${sessionMeta}</small>
        </span>
        <span class="history-cell score">${coverage}%</span>
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

async function loadReportHistory(nextToken = searchRequestToken) {
  const historyList = document.getElementById("historyList");
  if (historyList) {
    historyList.innerHTML = `<p class="history-empty">Loading analysis history...</p>`;
  }

  try {
    const payload = await fetchJson(buildPagedUrl("/history", state.historyPage));
    if (nextToken !== searchRequestToken) {
      return;
    }

    state.items = payload.items || [];
    state.historyTotal = Number(payload.total ?? state.items.length) || 0;

    const totalPages = getTotalPages(state.historyTotal);
    if (state.historyPage > totalPages) {
      state.historyPage = totalPages;
      await loadReportHistory(nextToken);
      return;
    }

    renderHistoryRows(
      state.items,
      state.query ? "No reports match the current file name or ID search." : "No analysis history has been saved yet.",
    );
    renderPagination({
      containerId: "historyPagination",
      page: state.historyPage,
      total: state.historyTotal,
      kind: "history",
      itemLabel: "reports",
    });
  } catch (error) {
    if (nextToken !== searchRequestToken) {
      return;
    }
    if (historyList) {
      historyList.innerHTML = `<p class="history-empty">${escapeHtml(error.message)}</p>`;
    }
  }
}

async function loadEyeHistory(nextToken = searchRequestToken) {
  const eyeHistoryList = document.getElementById("eyeHistoryList");
  if (eyeHistoryList) {
    eyeHistoryList.innerHTML = `<p class="history-empty">Loading eye-tracking evidence...</p>`;
  }

  try {
    const payload = await fetchJson(buildPagedUrl("/eye/sessions", state.eyePage));
    if (nextToken !== searchRequestToken) {
      return;
    }

    state.eyeItems = payload.items || [];
    state.eyeTotal = Number(payload.total ?? state.eyeItems.length) || 0;

    const totalPages = getTotalPages(state.eyeTotal);
    if (state.eyePage > totalPages) {
      state.eyePage = totalPages;
      await loadEyeHistory(nextToken);
      return;
    }

    renderEyeHistoryRows(
      state.eyeItems,
      state.query
        ? "No eye-tracking evidence sessions match the current search."
        : "No eye-tracking evidence sessions have been saved yet.",
    );
    renderPagination({
      containerId: "eyeHistoryPagination",
      page: state.eyePage,
      total: state.eyeTotal,
      kind: "eye",
      itemLabel: "sessions",
    });
  } catch (error) {
    if (nextToken !== searchRequestToken) {
      return;
    }
    if (eyeHistoryList) {
      eyeHistoryList.innerHTML = `<p class="history-empty">${escapeHtml(error.message)}</p>`;
    }
  }
}

async function loadHistoryPages() {
  const nextToken = ++searchRequestToken;
  await Promise.all([
    loadReportHistory(nextToken),
    loadEyeHistory(nextToken),
  ]);
}

async function runHistorySearch() {
  const searchInput = document.getElementById("historySearchInput");
  state.query = (searchInput?.value || "").trim();
  state.historyPage = 1;
  state.eyePage = 1;
  await loadHistoryPages();
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

function bindPaginationControls() {
  const paginationContainers = [
    document.getElementById("historyPagination"),
    document.getElementById("eyeHistoryPagination"),
  ];

  paginationContainers.forEach((container) => {
    if (!container || container.dataset.bound === "true") {
      return;
    }

    container.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-page-action]");
      if (!button || button.disabled) {
        return;
      }

      const controls = button.closest("[data-pagination-kind]");
      const kind = controls?.dataset.paginationKind;
      if (!kind) {
        return;
      }

      const total = kind === "history" ? state.historyTotal : state.eyeTotal;
      const totalPages = getTotalPages(total);
      const currentPage = kind === "history" ? state.historyPage : state.eyePage;
      let nextPage = currentPage;

      if (button.dataset.pageAction === "previous") {
        nextPage = Math.max(1, currentPage - 1);
      } else if (button.dataset.pageAction === "next") {
        nextPage = Math.min(totalPages, currentPage + 1);
      } else if (button.dataset.pageAction === "jump") {
        const input = controls.querySelector(".history-page-input");
        nextPage = Math.min(Math.max(1, Number(input?.value) || currentPage), totalPages);
      }

      if (nextPage === currentPage) {
        return;
      }

      const nextToken = ++searchRequestToken;
      if (kind === "history") {
        state.historyPage = nextPage;
        await loadReportHistory(nextToken);
      } else {
        state.eyePage = nextPage;
        await loadEyeHistory(nextToken);
      }
    });

    container.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }

      const input = event.target.closest(".history-page-input");
      if (!input) {
        return;
      }

      event.preventDefault();
      const controls = input.closest("[data-pagination-kind]");
      controls?.querySelector('[data-page-action="jump"]')?.click();
    });

    container.dataset.bound = "true";
  });
}

async function loadHistory() {
  const historyList = document.getElementById("historyList");
  const eyeHistoryList = document.getElementById("eyeHistoryList");
  if (!historyList || !eyeHistoryList) {
    return;
  }

  bindHistorySearch();
  bindPaginationControls();

  if (historyList.dataset.bound !== "true") {
    historyList.addEventListener("click", handleHistoryClick);
    historyList.dataset.bound = "true";
  }

  await loadHistoryPages();
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
