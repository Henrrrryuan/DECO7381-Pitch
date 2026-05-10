import { logRenderContext } from "../shared/renderForensics.js";
import { explanationAccordionBlockMarkup } from "../templates/detectorTemplates.js";
import { renderIssueSummaryCard } from "./issueRenderer.js";
import { dtLineageEnabled, summarizeDtLocationArray } from "../../observability/dtLocationLineage.js";

function amcAuditEnabled() {
  return typeof import.meta !== "undefined" && (import.meta.env?.DEV || import.meta.env?.VITE_AMC_AUDIT === "1");
}

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

  const dimensionsWithIssues = orderedDimensions
    .map((dimension) => ({
      dimension,
      filteredIssues: prioritizedIssuesForProfile(dimension),
    }))
    .filter((item) => item.filteredIssues.length > 0);

  if (!dimensionsWithIssues.length) {
    return `<p class="explanation-no-issue-cards">No triggered issues for the current Priority Lens—there are no detected issues to show.</p>`;
  }

  let globalIssueIndex = 0;
  const blocks = dimensionsWithIssues.map(({ dimension, filteredIssues }) => {
    if (dtLineageEnabled() && dimension?.dimension === "Dense Text Detection") {
      const dtIssue = (dimension?.issues || []).find((i) => (i?.rule_id || "") === "DT-1") || null;
      const rawSummary = summarizeDtLocationArray(dtIssue?.locations || []);
      console.log("[DT-1 location lineage]", {
        stage: "render.explanation.dimension.raw",
        ...rawSummary,
        dimension: dimension.dimension,
      });
    }
    const issueCount = filteredIssues.length;
    if (amcAuditEnabled() && dimension?.dimension === "Auto-Moving Content") {
      const amcIssue = (filteredIssues || []).find((i) => (i?.rule_id || "") === "AMC-1") || null;
      const locations = Array.isArray(amcIssue?.locations) ? amcIssue.locations : [];
      const aggregation = amcIssue?.evidence?.aggregation || {};
      const subgroupCounts = aggregation?.subgroup_counts || aggregation?.subgroupCounts || {};
      console.log("[AMC lineage]", {
        raw_candidate_count: null,
        issue_count: amcIssue ? 1 : 0,
        location_count_before_sanitize: null,
        location_count_after_sanitize: null,
        rendered_location_count: locations.length,
        grouped_into_single_issue: Boolean(amcIssue),
        grouping_reason: "single_issue_max_underlying_issue",
        collapse_detected: false,
        collapse_stage: "frontend.render.explanation.dimension.filtered",
      });
      console.log("[AMC aggregation]", {
        id1_location_count: aggregation?.id1_location_count ?? aggregation?.id1LocationCount ?? null,
        id2_location_count: aggregation?.id2_location_count ?? aggregation?.id2LocationCount ?? null,
        merged_location_count: aggregation?.merged_location_count ?? aggregation?.mergedLocationCount ?? locations.length,
        subgroup_counts: subgroupCounts,
        deduped_count: aggregation?.deduped_count ?? aggregation?.dedupedCount ?? locations.length,
        discarded_duplicates: aggregation?.discarded_duplicates ?? aggregation?.discardedDuplicates ?? null,
        rendered_group_count: Object.keys(subgroupCounts || {}).length,
      });
    }
    if (dtLineageEnabled() && dimension?.dimension === "Dense Text Detection") {
      const filteredDt = (filteredIssues || []).find((i) => (i?.rule_id || "") === "DT-1") || null;
      const filteredSummary = summarizeDtLocationArray(filteredDt?.locations || []);
      console.log("[DT-1 location lineage]", {
        stage: "render.explanation.dimension.filtered",
        ...filteredSummary,
        dimension: dimension.dimension,
        filtered_issue_count: issueCount,
      });
    }
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

    // If a detector produces a single issue, avoid nesting the issue card
    // inside a second "dimension accordion" card.
    if (issueCount === 1) {
      return issuesMarkup;
    }

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
