import { logRenderContext } from "../shared/renderForensics.js";
import { explanationAccordionBlockMarkup } from "../templates/detectorTemplates.js";
import { renderIssueSummaryCard } from "./issueRenderer.js";

function renderExplanationMarkup({
  result,
  escapeHtml,
  patientDetectorOrderIndex,
  prioritizedIssuesForProfile,
  displayDimensionName,
  cognitiveDimensionLabel,
  issueDomId,
  issueCardStandardsSummary,
  selectedIssueId,
  selectedElementNumber,
  issueRenderCtx,
} = {}) {
  const orderedDimensions = [...(result?.dimensions || [])]
    .sort((left, right) => patientDetectorOrderIndex(left?.dimension) - patientDetectorOrderIndex(right?.dimension));

  let globalIssueIndex = 0;
  const blocks = orderedDimensions.map((dimension) => {
    const filteredIssues = prioritizedIssuesForProfile(dimension);
    const issueCount = filteredIssues.length;
    const displayName = displayDimensionName(dimension.dimension);
    const cognitiveDimension = cognitiveDimensionLabel(dimension.dimension);
    const summary = issueCount === 0
      ? "No triggered issue for this detector."
      : cognitiveDimension;

    const issuesMarkup = issueCount
      ? `<div class="issue-highlight-list">${filteredIssues.map((issue, issueIndex) => {
          const issueNumber = globalIssueIndex + issueIndex + 1;
          const issueId = issueDomId(dimension.dimension, issue.rule_id);
          const { coga: cogaSummary, iso: isoSummary } = issueCardStandardsSummary(issue.rule_id || "");
          return renderIssueSummaryCard(
            issueRenderCtx,
            {
              issue,
              dimensionName: dimension.dimension,
              issueNumber,
              issueId,
              selectedIssueId,
              selectedElementNumber,
              cogaSummary,
              isoSummary,
            },
          );
        }).join("")}</div>`
      : "";

    globalIssueIndex += issueCount;

    const block = explanationAccordionBlockMarkup({
      displayNameEscaped: escapeHtml(displayName),
      issueCount,
      summaryEscaped: escapeHtml(summary),
      issuesMarkup,
    });
    logRenderContext({
      renderer: "detectorRenderer",
      context_type: "detector",
      issue_rule: "",
      selected: false,
      render_size: block.length,
    });
    return block;
  });

  return blocks.join("");
}

export { renderExplanationMarkup };
