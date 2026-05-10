function dashboardActionHandlersFactory() {
  return {
    PRINT_REPORT: ({ payload, ctx }) => {
      ctx.printDashboardReport({ restoreMode: payload?.restoreMode || "" });
    },

    TOGGLE_SIDEBAR: ({ ctx }) => {
      ctx.toggleSidebarCollapsed(ctx.state);
      try {
        sessionStorage.setItem(ctx.SIDEBAR_STORAGE_KEY, String(ctx.state.sidebarCollapsed));
      } catch (_) {
        // ignore storage quota / private mode
      }
      ctx.applySidebarState();
    },

    SET_ACTIVE_PROFILE: ({ payload, ctx }) => {
      const profileName = payload?.profileName || "Alison";
      if (!ctx.PATIENT_PROFILES?.[profileName] || ctx.state.activeProfile === profileName) {
        return;
      }
      ctx.setActivePatientProfileTransition(ctx.state, profileName);
      ctx.resetIssueWorkspaceForProfileChange();
      ctx.renderPatientSwitcher();
      if (ctx.state.currentResult) {
        ctx.renderExplanation(ctx.state.currentResult);
        ctx.renderDashboardSummary(ctx.state.currentResult);
        if (ctx.state.workspaceMode === "explanation") {
          ctx.renderComparison(ctx.state.currentResult, ctx.state.previousResult, ctx.state.previousSourceName);
        }
      }
    },

    SET_ACTIVE_HIGHLIGHT: ({ payload, ctx }) => {
      if (payload?.kind === "issue") {
        ctx.highlightIssue(payload.dimensionName, payload.ruleId);
        return;
      }
      if (payload?.kind === "dimension") {
        ctx.highlightDimension(payload.dimensionName);
      }
    },

    SELECT_ELEMENT: ({ payload, ctx }) => {
      ctx.focusIssueElement(payload?.dimensionName, payload?.ruleId, Number(payload?.elementNumber || 1));
    },

    TOGGLE_ASSISTANT: ({ payload, ctx }) => {
      ctx.setAssistantFloatingOpen(payload?.open === undefined ? true : Boolean(payload.open));
    },
  };
}

const dashboardActionHandlers = dashboardActionHandlersFactory();

export { dashboardActionHandlers, dashboardActionHandlersFactory };

