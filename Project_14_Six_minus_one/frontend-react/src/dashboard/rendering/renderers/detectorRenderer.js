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
  const dimensionsWithIssues = [...(result?.dimensions || [])]
    .sort((left, right) => patientDetectorOrderIndex(left?.dimension) - patientDetectorOrderIndex(right?.dimension))
    .map((dimension) => ({
      dimension,
      filteredIssues: prioritizedIssuesForProfile(dimension),
    }))
    .filter((item) => item.filteredIssues.length > 0);

  if (!dimensionsWithIssues.length) {
    return `<p class="explanation-no-issue-cards">No triggered issues for the current Priority Lens—there are no Top Issue Cards to show.</p>`;
  }

  let globalIssueIndex = 0;
  const blocks = dimensionsWithIssues.map(({ dimension, filteredIssues }) => {
    const issueCount = filteredIssues.length;
    const displayName = displayDimensionName(dimension.dimension);
    const cognitiveDimension = cognitiveDimensionLabel(dimension.dimension);

    const issuesMarkup = `<div class="issue-highlight-list">${filteredIssues.map((issue, issueIndex) => {
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
    }).join("")}</div>`;

    globalIssueIndex += issueCount;

    const block = explanationAccordionBlockMarkup({
      displayNameEscaped: escapeHtml(displayName),
      issueCount,
      summaryEscaped: escapeHtml(cognitiveDimension),
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
