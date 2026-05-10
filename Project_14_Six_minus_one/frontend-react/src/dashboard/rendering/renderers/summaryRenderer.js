import { logRenderContext } from "../shared/renderForensics.js";
import { dashboardSummaryMarkup } from "../templates/summaryTemplates.js";

function renderDashboardSummaryMarkup(result) {
  const totalIssues = (result?.dimensions || []).reduce((count, dimension) => {
    return count + ((dimension?.issues || []).length || 0);
  }, 0);
  const markup = dashboardSummaryMarkup(totalIssues);
  logRenderContext({
    renderer: "summaryRenderer",
    context_type: "summary",
    issue_rule: "",
    selected: false,
    render_size: markup.length,
  });
  return markup;
}

export { renderDashboardSummaryMarkup };

