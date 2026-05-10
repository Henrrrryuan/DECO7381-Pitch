import { buildIssueRenderContext } from "../context/renderContextBuilder.js";
import { logRenderContext } from "../shared/renderForensics.js";
import { issueSummaryCardMarkup as issueSummaryCardTemplate } from "../templates/issueTemplates.js";

function renderIssueSummaryCard(ctx, params) {
  const issueContext = buildIssueRenderContext(params);
  const markup = issueSummaryCardTemplate(ctx, issueContext);
  logRenderContext({
    renderer: "issueRenderer",
    context_type: issueContext.context_type,
    issue_rule: issueContext.rule_id,
    selected: issueContext.isSelected,
    render_size: markup.length,
  });
  return markup;
}

export { renderIssueSummaryCard };

