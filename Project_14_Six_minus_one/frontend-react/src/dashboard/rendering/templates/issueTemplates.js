import { cogaGuidanceMarkup, standardsPillsMarkup } from "../shared/renderHelpers.js";
import { dtLineageEnabled, summarizeDtLocationArray } from "../../observability/dtLocationLineage.js";

function issueElementChipRowMarkup(ctx, issue, dimensionName, location, elementNumber, activeElementNumber, chipOptions = {}) {
  const {
    escapeHtml,
    friendlyLocationLabel,
    locationMetaText,
    formatViolationTypeLabel,
    scTextBlockPrimaryLabel,
    lcTextBlockPrimaryLabel,
    ncEvidenceMetricsLine,
    ncTechnicalMetaLine,
    scAllThreeSentenceMetricsAbsent,
    scSentenceEvidenceMetricsLine,
    scPrimaryPattern,
    scSecondaryPatterns,
    scCompressedSentencePreview,
    lcLexicalEvidenceMetricsLine,
    lcCompactSampleWords,
    NC_GROUPED_METRICS_FALLBACK,
    SC_CHIP_METRICS_FALLBACK,
  } = ctx;

  const isActive = activeElementNumber === elementNumber;
  const issueRuleId = issue?.rule_id || "";
  const isNc = issueRuleId === "NC-1";
  const isSc = issueRuleId === "SC-1";
  const isLc = issueRuleId === "LC-1";
  const ncGroupedLayout = Boolean(chipOptions.ncGrouped) && isNc;
  const label = isNc
    ? "Navigation Region"
    : isSc
      ? scTextBlockPrimaryLabel(location)
      : isLc
        ? lcTextBlockPrimaryLabel(location)
        : (location?.label || friendlyLocationLabel(location, issueRuleId));
  const isHighlightable = location?.highlightable !== false;
  let ncMetricsLine = "";
  let ncTechnicalLine = "";
  let scMetricsLine = "";
  let scPreviewLine = "";
  let lcMetricsLine = "";
  let lcSamplesLine = "";
  let meta = "";
  let showMeta = false;
  if (isNc) {
    ncMetricsLine = ncEvidenceMetricsLine(location);
    if (ncGroupedLayout && !ncMetricsLine) {
      ncMetricsLine = NC_GROUPED_METRICS_FALLBACK;
    }
    ncTechnicalLine = ncTechnicalMetaLine(location);
  } else if (isSc) {
    const metricsAbsent = scAllThreeSentenceMetricsAbsent(location);
    if (metricsAbsent) {
      console.warn("[SC-1 debug] Sentence metrics unavailable (chip) — raw location:", location);
    }
    scMetricsLine = metricsAbsent ? SC_CHIP_METRICS_FALLBACK : scSentenceEvidenceMetricsLine(location);
    scPreviewLine = String(location.sentence_preview || "").trim();
  } else if (isLc) {
    lcMetricsLine = lcLexicalEvidenceMetricsLine(location);
    lcSamplesLine = lcCompactSampleWords(location);
  } else {
    meta = locationMetaText(location, null, issueRuleId)
      .replace(/^Location: /, "")
      .replace(/\s*Highlighted as Element \d+\s*·\s*/i, "");
    showMeta = Boolean(meta && meta !== label);
  }
  if (!isHighlightable) {
    const strongLabel = location?.violationType
      ? formatViolationTypeLabel(location.violationType)
      : "Evidence";
    const statusFallback = location?.violationType === "missing_headings"
      ? "Document-level structural finding — no single DOM highlight."
      : "No visible target found";
    return `
      <div class="issue-element-chip is-disabled" role="note">
        <strong>${escapeHtml(strongLabel)}</strong>
        <span>${escapeHtml(label || "Structural evidence, not directly highlightable")}</span>
        <small>${escapeHtml(location?.status || statusFallback)}</small>
      </div>
    `;
  }
  if (isSc) {
    const primaryLine = scPrimaryPattern(location);
    const secondaryList = scSecondaryPatterns(location);
    const secondaryLine = secondaryList.length ? `Secondary: ${secondaryList.join(" · ")}` : "";
    return `
    <button
      class="issue-element-chip issue-element-chip--sc${isActive ? " is-active" : ""}"
      type="button"
      data-issue-element="${escapeHtml(issue.rule_id)}"
      data-issue-dimension="${escapeHtml(dimensionName)}"
      data-element-index="${elementNumber}"
      aria-pressed="${isActive ? "true" : "false"}"
    >
      <strong>Element ${elementNumber}</strong>
      <span>${escapeHtml(label)}</span>
      <small class="issue-element-chip__sc-primary">${escapeHtml(primaryLine)}</small>
      <small class="issue-element-chip__sc-metrics">${escapeHtml(scMetricsLine)}</small>
      ${secondaryLine ? `<small class="issue-element-chip__sc-secondary summary-muted">${escapeHtml(secondaryLine)}</small>` : ""}
      ${scPreviewLine ? `<small class="issue-element-chip__sc-preview summary-muted">${escapeHtml(scCompressedSentencePreview(scPreviewLine))}</small>` : ""}
    </button>
  `;
  }
  if (isLc) {
    return `
    <button
      class="issue-element-chip issue-element-chip--lc${isActive ? " is-active" : ""}"
      type="button"
      data-issue-element="${escapeHtml(issue.rule_id)}"
      data-issue-dimension="${escapeHtml(dimensionName)}"
      data-element-index="${elementNumber}"
      aria-pressed="${isActive ? "true" : "false"}"
    >
      <strong>Element ${elementNumber}</strong>
      <span>${escapeHtml(label)}</span>
      ${lcMetricsLine ? `<small class="issue-element-chip__lc-metrics">${escapeHtml(lcMetricsLine)}</small>` : ""}
      ${lcSamplesLine ? `<small class="issue-element-chip__lc-samples summary-muted">${escapeHtml(lcSamplesLine)}</small>` : ""}
    </button>
  `;
  }
  const secondarySpan = ncGroupedLayout
    ? `<strong class="issue-element-chip__nc-primary-label">${escapeHtml(label)}</strong>`
    : `<span>${escapeHtml(label || `Affected element ${elementNumber}`)}</span>`;
  return `
    <button
      class="issue-element-chip${ncGroupedLayout ? " issue-element-chip--nc-grouped" : ""}${isActive ? " is-active" : ""}"
      type="button"
      data-issue-element="${escapeHtml(issue.rule_id)}"
      data-issue-dimension="${escapeHtml(dimensionName)}"
      data-element-index="${elementNumber}"
      aria-pressed="${isActive ? "true" : "false"}"
    >
      ${ncGroupedLayout ? "" : `<strong>Element ${elementNumber}</strong>`}
      ${secondarySpan}
      ${isNc && (ncGroupedLayout || ncMetricsLine) ? `<small class="issue-element-chip__nc-metrics">${escapeHtml(ncMetricsLine || NC_GROUPED_METRICS_FALLBACK)}</small>` : ""}
      ${isNc && ncTechnicalLine ? `<small class="issue-element-chip__nc-technical summary-muted">${escapeHtml(ncTechnicalLine)}</small>` : ""}
      ${!isNc && !isSc && !isLc && showMeta ? `<small>${escapeHtml(meta)}</small>` : ""}
    </button>
  `;
}

function issuePhsGroupedChipSectionsMarkup(ctx, issue, dimensionName, visibleSlice, activeElementNumber) {
  const { escapeHtml, groupLocationsByViolationType, orderPhsViolationGroupKeys, formatViolationTypeLabel } = ctx;
  const grouped = groupLocationsByViolationType(visibleSlice);
  const keys = orderPhsViolationGroupKeys(Object.keys(grouped));
  return keys.map((violationKey) => {
    const entries = grouped[violationKey];
    const title = `${formatViolationTypeLabel(violationKey)} (${entries.length})`;
    const chips = entries.map(({ location, elementNumber }) => (
      issueElementChipRowMarkup(ctx, issue, dimensionName, location, elementNumber, activeElementNumber)
    )).join("");
    return `
      <section class="issue-phs-violation-group" aria-label="${escapeHtml(formatViolationTypeLabel(violationKey))}">
        <h5 class="issue-phs-violation-heading">${escapeHtml(title)}</h5>
        <div class="issue-element-chip-list issue-element-chip-list--phs-group">
          ${chips}
        </div>
      </section>
    `;
  }).join("");
}

function issueVoGroupedChipSectionsMarkup(ctx, issue, dimensionName, visibleSlice, activeElementNumber) {
  const { escapeHtml, groupLocationsByContributorCategory, orderVoContributorCategoryKeys, formatContributorCategoryLabel } = ctx;
  const grouped = groupLocationsByContributorCategory(visibleSlice);
  const keys = orderVoContributorCategoryKeys(Object.keys(grouped));
  return keys.map((categoryKey) => {
    const entries = grouped[categoryKey];
    const title = `${formatContributorCategoryLabel(categoryKey)} (${entries.length})`;
    const chips = entries.map(({ location, elementNumber }) => (
      issueElementChipRowMarkup(ctx, issue, dimensionName, location, elementNumber, activeElementNumber)
    )).join("");
    return `
      <section class="issue-phs-violation-group issue-vo-contributor-group" aria-label="${escapeHtml(formatContributorCategoryLabel(categoryKey))}">
        <h5 class="issue-phs-violation-heading">${escapeHtml(title)}</h5>
        <div class="issue-element-chip-list issue-element-chip-list--phs-group">
          ${chips}
        </div>
      </section>
    `;
  }).join("");
}

function issueWipSingleGroupChipSectionsMarkup(ctx, issue, dimensionName, visibleSlice, activeElementNumber, totalLocationCount) {
  const { escapeHtml } = ctx;
  const title = `Competing Primary Actions (${totalLocationCount})`;
  const chips = visibleSlice.map((location, index) => (
    issueElementChipRowMarkup(ctx, issue, dimensionName, location, index + 1, activeElementNumber)
  )).join("");
  return `
      <section class="issue-phs-violation-group issue-wip-single-group" aria-label="Competing Primary Actions">
        <h5 class="issue-phs-violation-heading">${escapeHtml(title)}</h5>
        <div class="issue-element-chip-list issue-element-chip-list--phs-group">
          ${chips}
        </div>
      </section>
    `;
}

function issueAmcGroupedChipSectionsMarkup(ctx, issue, dimensionName, activeElementNumber) {
  const {
    escapeHtml,
    groupAmcLocationsBySubtype,
    amcSubtypeLabel,
    amcSubtypeOrder,
  } = ctx;
  const locations = Array.isArray(issue?.locations) ? issue.locations : [];
  const grouped = groupAmcLocationsBySubtype(locations);
  const subtypeKeys = Object.keys(grouped);
  const ordered = subtypeKeys.sort((a, b) => amcSubtypeOrder(a) - amcSubtypeOrder(b));
  return ordered.map((subtype) => {
    const entries = grouped[subtype] || [];
    const label = amcSubtypeLabel(subtype);
    const title = `${label} (${entries.length})`;
    const chips = entries.map(({ location, elementNumber }) => (
      issueElementChipRowMarkup(ctx, issue, dimensionName, location, elementNumber, activeElementNumber)
    )).join("");
    return `
      <section class="issue-phs-violation-group issue-amc-subtype-group" aria-label="${escapeHtml(label)}">
        <h5 class="issue-phs-violation-heading">${escapeHtml(title)}</h5>
        <div class="issue-element-chip-list issue-element-chip-list--phs-group">
          ${chips}
        </div>
      </section>
    `;
  }).join("");
}

function issueEiGroupedChipSectionsMarkup(ctx, issue, dimensionName, activeElementNumber) {
  const {
    escapeHtml,
    groupEiLocationsBySubtype,
    eiSubtypeLabel,
    eiSubtypeOrder,
  } = ctx;
  const locations = Array.isArray(issue?.locations) ? issue.locations : [];
  const grouped = groupEiLocationsBySubtype(locations);
  const subtypeKeys = Object.keys(grouped);
  const ordered = subtypeKeys.sort((a, b) => eiSubtypeOrder(a) - eiSubtypeOrder(b));
  return ordered.map((subtype) => {
    const entries = grouped[subtype] || [];
    const label = eiSubtypeLabel(subtype);
    const title = `${label} (${entries.length})`;
    const chips = entries.map(({ location, elementNumber }) => (
      issueElementChipRowMarkup(ctx, issue, dimensionName, location, elementNumber, activeElementNumber)
    )).join("");
    return `
      <section class="issue-phs-violation-group issue-ei-subtype-group" aria-label="${escapeHtml(label)}">
        <h5 class="issue-phs-violation-heading">${escapeHtml(title)}</h5>
        <div class="issue-element-chip-list issue-element-chip-list--phs-group">
          ${chips}
        </div>
      </section>
    `;
  }).join("");
}

function issueElementListMarkup(ctx, issue, dimensionName, selectedIssueId, selectedElementNumber) {
  const { escapeHtml, issueDomId } = ctx;
  const locations = Array.isArray(issue?.locations) ? issue.locations : [];
  const selectedIdForIssue = issueDomId(dimensionName, issue.rule_id);
  const activeElementNumber = String(selectedIssueId || "") === String(selectedIdForIssue || "")
    ? Number(selectedElementNumber || 0)
    : 0;

  if (dtLineageEnabled() && (issue?.rule_id || "") === "DT-1") {
    console.log("[DT-1 location lineage]", {
      stage: "issue.template.input",
      ...summarizeDtLocationArray(locations),
      dimension: dimensionName,
    });
  }

  if ((issue.rule_id || "") === "PHS-1" && locations.length > 0) {
    const visibleSlice = locations.slice(0, 12);
    const hiddenCount = Math.max(0, locations.length - visibleSlice.length);
    const groupedSections = issuePhsGroupedChipSectionsMarkup(ctx, issue, dimensionName, visibleSlice, activeElementNumber);
    return `
      <div class="issue-summary-row issue-summary-row-elements">
        <div class="issue-phs-grouped-wrap">
          ${groupedSections}
        </div>
        ${hiddenCount ? `<p class="issue-element-hidden-count">+${hiddenCount} more affected element${hiddenCount === 1 ? "" : "s"}.</p>` : ""}
      </div>
    `;
  }

  if ((issue.rule_id || "") === "VO-1" && locations.length > 0) {
    const visibleSlice = locations.slice(0, 12);
    const hiddenCount = Math.max(0, locations.length - visibleSlice.length);
    const groupedSections = issueVoGroupedChipSectionsMarkup(ctx, issue, dimensionName, visibleSlice, activeElementNumber);
    return `
      <div class="issue-summary-row issue-summary-row-elements">
        <div class="issue-phs-grouped-wrap issue-vo-contributor-wrap">
          ${groupedSections}
        </div>
        ${hiddenCount ? `<p class="issue-element-hidden-count">+${hiddenCount} more affected element${hiddenCount === 1 ? "" : "s"}.</p>` : ""}
      </div>
    `;
  }

  if ((issue.rule_id || "") === "WIP-1" && locations.length > 0) {
    const visibleSlice = locations.slice(0, 12);
    const hiddenCount = Math.max(0, locations.length - visibleSlice.length);
    const groupedSections = issueWipSingleGroupChipSectionsMarkup(
      ctx,
      issue,
      dimensionName,
      visibleSlice,
      activeElementNumber,
      locations.length,
    );
    return `
      <div class="issue-summary-row issue-summary-row-elements">
        <div class="issue-phs-grouped-wrap issue-wip-single-wrap">
          ${groupedSections}
        </div>
        ${hiddenCount ? `<p class="issue-element-hidden-count">+${hiddenCount} more affected element${hiddenCount === 1 ? "" : "s"}.</p>` : ""}
      </div>
    `;
  }

  if ((issue.rule_id || "") === "AMC-1" && locations.length > 0) {
    const groupedSections = issueAmcGroupedChipSectionsMarkup(ctx, issue, dimensionName, activeElementNumber);
    return `
      <div class="issue-summary-row issue-summary-row-elements">
        <div class="issue-phs-grouped-wrap issue-amc-grouped-wrap">
          ${groupedSections}
        </div>
      </div>
    `;
  }

  if ((issue.rule_id || "") === "EI-1" && locations.length > 0) {
    const groupedSections = issueEiGroupedChipSectionsMarkup(ctx, issue, dimensionName, activeElementNumber);
    return `
      <div class="issue-summary-row issue-summary-row-elements">
        <div class="issue-phs-grouped-wrap issue-ei-grouped-wrap">
          ${groupedSections}
        </div>
      </div>
    `;
  }

  const inferredCount = Math.max(1, locations.length || 0);
  const shown = locations.slice(0, 12);
  const hiddenCount = Math.max(0, inferredCount - shown.length);
  if (dtLineageEnabled() && (issue?.rule_id || "") === "DT-1") {
    console.log("[DT-1 location lineage]", {
      stage: "grouped.issue.locations",
      ...summarizeDtLocationArray(shown),
      dimension: dimensionName,
      hidden_count: hiddenCount,
    });
  }
  const chips = shown.map((location, index) => (
    issueElementChipRowMarkup(ctx, issue, dimensionName, location, index + 1, activeElementNumber)
  )).join("");
  if (dtLineageEnabled() && (issue?.rule_id || "") === "DT-1") {
    console.log("[DT-1 location lineage]", {
      stage: "issue.template.output",
      dt_location_count: shown.length,
      dt_location_ids: summarizeDtLocationArray(shown).dt_location_ids,
      duplicate_selector_count: summarizeDtLocationArray(shown).duplicate_selector_count,
      duplicate_text_count: summarizeDtLocationArray(shown).duplicate_text_count,
      grouped_keys: [],
      collapsed_ids: [],
      surviving_ids: summarizeDtLocationArray(shown).dt_location_ids,
      markup_length: chips.length,
      dimension: dimensionName,
    });
  }
  return `
    <div class="issue-summary-row issue-summary-row-elements">
      <div class="issue-element-chip-list">
        ${chips}
      </div>
      ${hiddenCount ? `<p class="issue-element-hidden-count">+${hiddenCount} more affected element${hiddenCount === 1 ? "" : "s"}.</p>` : ""}
    </div>
  `;
}

function issueSummaryCardMarkup(ctx, issueContext) {
  const { escapeHtml } = ctx;
  const { issue, dimensionName, issueNumber, selectedClass, cogaSummary, isoSummary, issueId, selectedIssueId, selectedElementNumber } = issueContext;
  const cogaMarkup = cogaGuidanceMarkup({ summaryText: cogaSummary, escapeHtml });
  const isoMarkup = standardsPillsMarkup({ summaryText: isoSummary, fallbackText: "Effectiveness, efficiency, satisfaction.", escapeHtml });

  return `
    <details
      class="issue-highlight-button issue-summary-card${selectedClass}"
      data-highlight-issue="${escapeHtml(issue.rule_id)}"
      data-highlight-dimension="${escapeHtml(dimensionName)}"
    >
      <summary class="issue-summary-toggle">
        <div class="issue-summary-topline">
          <span class="issue-highlight-rule">Issue ${issueNumber}</span>
          <span class="issue-summary-chevron" aria-hidden="true">▾</span>
        </div>
        <strong class="issue-summary-title">${escapeHtml(issue.title || "Review this issue")}</strong>
      </summary>
      <div class="issue-summary-body">
        <div class="issue-summary-row issue-summary-row-standards">
          <span class="issue-highlight-label issue-highlight-label--wcag-guidance">WCAG Cognitive Accessibility Guidance</span>
          ${cogaMarkup}
        </div>
        <div class="issue-summary-row issue-summary-row-standards">
          <span class="issue-highlight-label">ISO 9241-11</span>
          ${isoMarkup}
        </div>
        ${issueElementListMarkup(ctx, issue, dimensionName, selectedIssueId, selectedElementNumber)}
      </div>
    </details>
  `;
}

export {
  issueElementChipRowMarkup,
  issueElementListMarkup,
  issueSummaryCardMarkup,
};

