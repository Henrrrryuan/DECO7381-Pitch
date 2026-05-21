import { DASHBOARD_ACTIONS } from "./dashboardActions.js";
import { dashboardActionHandlers } from "./dashboardActionHandlers.js";

const ACTION_TYPE_TO_HANDLER = {
  [DASHBOARD_ACTIONS.PRINT_REPORT]: dashboardActionHandlers.PRINT_REPORT,
  [DASHBOARD_ACTIONS.TOGGLE_SIDEBAR]: dashboardActionHandlers.TOGGLE_SIDEBAR,
  [DASHBOARD_ACTIONS.SET_ACTIVE_PROFILE]: dashboardActionHandlers.SET_ACTIVE_PROFILE,
  [DASHBOARD_ACTIONS.SET_ACTIVE_HIGHLIGHT]: dashboardActionHandlers.SET_ACTIVE_HIGHLIGHT,
  [DASHBOARD_ACTIONS.SELECT_ELEMENT]: dashboardActionHandlers.SELECT_ELEMENT,
};

function getDashboardActionHandler(type) {
  return ACTION_TYPE_TO_HANDLER[type] || null;
}

function hasDashboardActionHandler(type) {
  return Boolean(getDashboardActionHandler(type));
}

export { getDashboardActionHandler, hasDashboardActionHandler };

