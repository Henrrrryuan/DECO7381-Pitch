import { buildIssueRenderContext } from "../context/renderContextBuilder.js";
import { logRenderContext } from "../shared/renderForensics.js";
import { issueSummaryCardMarkup as issueSummaryCardTemplate } from "../templates/issueTemplates.js";
import { dtLineageEnabled, summarizeDtLocationArray } from "../../observability/dtLocationLineage.js";

function renderIssueSummaryCard(ctx, params) {
  const issueContext = buildIssueRenderContext(params);
  if (dtLineageEnabled() && (issueContext?.rule_id || "") === "DT-1") {
    console.log("[DT-1 location lineage]", {
      stage: "issue.summary.card.build",
      ...summarizeDtLocationArray(issueContext?.issue?.locations || []),
      dimension: issueContext?.dimensionName || "",
      issue_number: issueContext?.issueNumber || null,
    });
  }
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

