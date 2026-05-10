async function hydrateStoredDashboardSession({
  storedSession,
  fetchJson,
  API_BASE,
  buildDashboardSessionFromHistoryDetail,
  readDashboardAuthoritativeSourceFromStorage,
  getRunIdFromPayload,
  logDashboardLifecycle,
  buildAnalysisView,
  logDtFrontendState,
}) {
  const current = storedSession?.current;
  const hasHtml = Boolean(current?.html || current?.payload?.html_content);
  const runId = current?.payload?.run?.run_id || current?.payload?.run?.id || current?.payload?.run_id;

  if (!current?.payload || hasHtml || !runId) {
    logDtFrontendState?.({
      stage: "hydrateStoredDashboardSession.skip",
      payload: current?.payload || null,
      result: current?.payload ? buildAnalysisView(current.payload) : null,
      sourceNameOverride: current?.sourceName || "",
    });
    return storedSession;
  }

  try {
    const authoritative = readDashboardAuthoritativeSourceFromStorage?.();
    if (
      authoritative
      && authoritative.source_type === "fresh_analysis"
      && authoritative.run_id
      && String(authoritative.run_id) !== String(runId)
    ) {
      logDashboardLifecycle?.({
        stage: "history.skip",
        incomingPayload: { run: { run_id: runId } },
        currentPayload: { run: { run_id: authoritative.run_id } },
        incomingSourceType: "history_hydration",
        currentSourceType: "fresh_analysis",
        accepted: false,
        reason: "fresh_analysis authoritative run present; skip history hydration of older storage run",
      });
      return storedSession;
    }

    const detail = await fetchJson(`${API_BASE}/history/${encodeURIComponent(runId)}`);
    const hydrated = buildDashboardSessionFromHistoryDetail(detail);
    logDtFrontendState?.({
      stage: "hydrateStoredDashboardSession.history_merge",
      payload: hydrated?.current?.payload || null,
      result: hydrated?.current?.payload ? buildAnalysisView(hydrated.current.payload) : null,
      sourceNameOverride: hydrated?.current?.sourceName || "",
    });
    return {
      ...storedSession,
      current: {
        ...current,
        ...hydrated.current,
        payload: {
          ...current.payload,
          ...hydrated.current.payload,
        },
      },
    };
  } catch (error) {
    return storedSession;
  }
}

async function loadDashboardSessionWithHistoryFallback({
  getHistoryReportRunIdFromUrl,
  fetchJson,
  API_BASE,
  buildDashboardSessionFromHistoryDetail,
  loadDashboardSession,
  readDashboardAuthoritativeSourceFromStorage,
  hydrateStoredDashboardSessionFn,
  logDashboardLifecycle,
  buildAnalysisView,
  logDtFrontendState,
}) {
  const runId = getHistoryReportRunIdFromUrl();
  if (runId) {
    const detail = await fetchJson(`${API_BASE}/history/${encodeURIComponent(runId)}`);
    const fromHistory = buildDashboardSessionFromHistoryDetail(detail);
    logDashboardLifecycle?.({
      stage: "history.load",
      incomingPayload: fromHistory?.current?.payload || null,
      currentPayload: null,
      incomingSourceType: "history",
      currentSourceType: "",
      accepted: true,
      reason: "explicit URL history run requested",
    });
    logDtFrontendState?.({
      stage: "loadDashboardSessionWithHistoryFallback.url_history",
      payload: fromHistory?.current?.payload || null,
      result: fromHistory?.current?.payload ? buildAnalysisView(fromHistory.current.payload) : null,
      sourceNameOverride: fromHistory?.current?.sourceName || "",
    });
    return fromHistory;
  }

  const storedSession = loadDashboardSession();
  logDashboardLifecycle?.({
    stage: "storage.load",
    incomingPayload: storedSession?.current?.payload || null,
    currentPayload: null,
    incomingSourceType: "storage",
    currentSourceType: "",
    accepted: true,
    reason: "loaded dashboard session from storage",
  });
  logDtFrontendState?.({
    stage: "loadDashboardSessionWithHistoryFallback.storage_raw",
    payload: storedSession?.current?.payload || null,
    result: storedSession?.current?.payload ? buildAnalysisView(storedSession.current.payload) : null,
    sourceNameOverride: storedSession?.current?.sourceName || "",
  });

  const authoritative = readDashboardAuthoritativeSourceFromStorage?.();
  if (authoritative && authoritative.source_type === "fresh_analysis" && authoritative.run_id) {
    const storedRunId = getRunIdFromPayload ? getRunIdFromPayload(storedSession?.current?.payload || null) : "";
    if (String(authoritative.run_id) !== String(storedRunId)) {
      try {
        const detail = await fetchJson(`${API_BASE}/history/${encodeURIComponent(authoritative.run_id)}`);
        const fromAuthoritative = buildDashboardSessionFromHistoryDetail(detail);
        logDashboardLifecycle?.({
          stage: "storage.skip",
          incomingPayload: storedSession?.current?.payload || null,
          currentPayload: fromAuthoritative?.current?.payload || null,
          incomingSourceType: "storage",
          currentSourceType: "fresh_analysis",
          accepted: true,
          reason: "authoritative fresh_analysis marker overrides stored session",
        });
        return fromAuthoritative;
      } catch (error) {
        // Fall back to stored session if authoritative run cannot be fetched.
      }
    }
  }

  return hydrateStoredDashboardSessionFn({ storedSession });
}

export {
  hydrateStoredDashboardSession,
  loadDashboardSessionWithHistoryFallback,
};

