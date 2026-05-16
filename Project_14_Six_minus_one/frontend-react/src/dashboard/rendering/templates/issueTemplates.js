import { cogaGuidanceMarkup, standardsPillsMarkup } from "../shared/renderHelpers.js";
import { dtLineageEnabled, summarizeDtLocationArray } from "../../observability/dtLocationLineage.js";

const ISSUE_ELEMENT_DISPLAY_LIMIT = 3;

function issueLocationDisplayEntries(locations, limit = ISSUE_ELEMENT_DISPLAY_LIMIT) {
  if (!Array.isArray(locations)) {
    return [];
  }
  return locations.map((location, index) => ({
    location,
    elementNumber: index + 1,
  })).slice(0, limit);
}

function hiddenCountLabel(ruleId, hiddenCount) {
  if (!hiddenCount) {
    return "";
  }
  const labelsByRule = {
    "PHS-1": ["heading structure signal", "heading structure signals"],
    "WIP-1": ["competing action signal", "competing action signals"],
    "VO-1": ["visual overload signal", "visual overload signals"],
    "AMC-1": ["motion signal", "motion signals"],
    "EI-1": ["interruption signal", "interruption signals"],
  };
  const [singular, plural] = labelsByRule[String(ruleId || "")] || ["affected element", "affected elements"];
  return `+${hiddenCount} more ${hiddenCount === 1 ? singular : plural}`;
}

function elementListToggleMarkup({ issue, dimensionName, hiddenCount, expanded, escapeHtml }) {
  const hasToggle = expanded || hiddenCount > 0;
  if (!hasToggle) {
    return "";
  }
  const label = expanded ? "Show less" : hiddenCountLabel(issue?.rule_id, hiddenCount);
  return `
    <button
      class="issue-element-hidden-count issue-element-toggle"
      type="button"
      data-expand-issue-elements="${expanded ? "collapse" : "expand"}"
      data-issue-dimension="${escapeHtml(dimensionName)}"
      data-issue-rule="${escapeHtml(issue?.rule_id || "")}"
      aria-expanded="${expanded ? "true" : "false"}"
    >${escapeHtml(label)}</button>
  `;
}

function groupEntriesBy(entries, keyForEntry) {
  const groups = {};
  if (!Array.isArray(entries)) {
    return groups;
  }
  entries.forEach((entry) => {
    const key = keyForEntry(entry);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(entry);
  });
  return groups;
}

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
      data-accessibility-tooltip="${escapeHtml(`Show Element ${elementNumber} in the website preview for ${issue.title || "this issue"}.`)}"
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
      data-accessibility-tooltip="${escapeHtml(`Show Element ${elementNumber} in the website preview for ${issue.title || "this issue"}.`)}"
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
      data-accessibility-tooltip="${escapeHtml(`Show Element ${elementNumber} in the website preview for ${issue.title || "this issue"}.`)}"
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

function issuePhsGroupedChipSectionsMarkup(ctx, issue, dimensionName, visibleEntries, activeElementNumber) {
  const { escapeHtml, orderPhsViolationGroupKeys, formatViolationTypeLabel } = ctx;
  const grouped = groupEntriesBy(visibleEntries, ({ location }) => {
    const raw = location?.violationType;
    return typeof raw === "string" && raw.trim() ? raw.trim() : "unknown";
  });
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

function issueVoGroupedChipSectionsMarkup(ctx, issue, dimensionName, visibleEntries, activeElementNumber) {
  const { escapeHtml, orderVoContributorCategoryKeys, formatContributorCategoryLabel } = ctx;
  const grouped = groupEntriesBy(visibleEntries, ({ location }) => {
    const raw = location?.contributorCategory;
    return typeof raw === "string" && raw.trim() ? raw.trim() : "unknown";
  });
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

function issueWipSingleGroupChipSectionsMarkup(ctx, issue, dimensionName, visibleEntries, activeElementNumber, totalLocationCount) {
  const { escapeHtml } = ctx;
  const title = `Competing Primary Actions (${totalLocationCount})`;
  const chips = visibleEntries.map(({ location, elementNumber }) => (
    issueElementChipRowMarkup(ctx, issue, dimensionName, location, elementNumber, activeElementNumber)
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

function issueAmcGroupedChipSectionsMarkup(ctx, issue, dimensionName, visibleEntries, activeElementNumber) {
  const {
    escapeHtml,
    amcSubtypeLabel,
    amcSubtypeOrder,
  } = ctx;
  const grouped = groupEntriesBy(visibleEntries, ({ location }) => {
    return String(location?.movement_subtype || location?.movementSubtype || "").trim() || "other_motion";
  });
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

function issueEiGroupedChipSectionsMarkup(ctx, issue, dimensionName, visibleEntries, activeElementNumber) {
  const {
    escapeHtml,
    eiSubtypeLabel,
    eiSubtypeOrder,
  } = ctx;
  const grouped = groupEntriesBy(visibleEntries, ({ location }) => {
    const raw = String(location?.interrupt_type || location?.interruptType || "").trim();
    return raw || "other";
  });
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

function issueElementListMarkup(ctx, issue, dimensionName, selectedIssueId, selectedElementNumber, issueElementsExpanded = false) {
  const { escapeHtml, issueDomId } = ctx;
  const locations = Array.isArray(issue?.locations) ? issue.locations : [];
  const displayLimit = issueElementsExpanded ? locations.length : ISSUE_ELEMENT_DISPLAY_LIMIT;
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
    const visibleEntries = issueLocationDisplayEntries(locations, displayLimit);
    const hiddenCount = issueElementsExpanded ? 0 : Math.max(0, locations.length - visibleEntries.length);
    const groupedSections = issuePhsGroupedChipSectionsMarkup(ctx, issue, dimensionName, visibleEntries, activeElementNumber);
    return `
      <div class="issue-summary-row issue-summary-row-elements">
        <div class="issue-phs-grouped-wrap">
          ${groupedSections}
        </div>
        ${elementListToggleMarkup({ issue, dimensionName, hiddenCount, expanded: issueElementsExpanded, escapeHtml })}
      </div>
    `;
  }

  if ((issue.rule_id || "") === "VO-1" && locations.length > 0) {
    const visibleEntries = issueLocationDisplayEntries(locations, displayLimit);
    const hiddenCount = issueElementsExpanded ? 0 : Math.max(0, locations.length - visibleEntries.length);
    const groupedSections = issueVoGroupedChipSectionsMarkup(ctx, issue, dimensionName, visibleEntries, activeElementNumber);
    return `
      <div class="issue-summary-row issue-summary-row-elements">
        <div class="issue-phs-grouped-wrap issue-vo-contributor-wrap">
          ${groupedSections}
        </div>
        ${elementListToggleMarkup({ issue, dimensionName, hiddenCount, expanded: issueElementsExpanded, escapeHtml })}
      </div>
    `;
  }

  if ((issue.rule_id || "") === "WIP-1" && locations.length > 0) {
    const visibleEntries = issueLocationDisplayEntries(locations, displayLimit);
    const hiddenCount = issueElementsExpanded ? 0 : Math.max(0, locations.length - visibleEntries.length);
    const groupedSections = issueWipSingleGroupChipSectionsMarkup(
      ctx,
      issue,
      dimensionName,
      visibleEntries,
      activeElementNumber,
      locations.length,
    );
    return `
      <div class="issue-summary-row issue-summary-row-elements">
        <div class="issue-phs-grouped-wrap issue-wip-single-wrap">
          ${groupedSections}
        </div>
        ${elementListToggleMarkup({ issue, dimensionName, hiddenCount, expanded: issueElementsExpanded, escapeHtml })}
      </div>
    `;
  }

  if ((issue.rule_id || "") === "AMC-1" && locations.length > 0) {
    const visibleEntries = issueLocationDisplayEntries(locations, displayLimit);
    const hiddenCount = issueElementsExpanded ? 0 : Math.max(0, locations.length - visibleEntries.length);
    const groupedSections = issueAmcGroupedChipSectionsMarkup(ctx, issue, dimensionName, visibleEntries, activeElementNumber);
    return `
      <div class="issue-summary-row issue-summary-row-elements">
        <div class="issue-phs-grouped-wrap issue-amc-grouped-wrap">
          ${groupedSections}
        </div>
        ${elementListToggleMarkup({ issue, dimensionName, hiddenCount, expanded: issueElementsExpanded, escapeHtml })}
      </div>
    `;
  }

  if ((issue.rule_id || "") === "EI-1" && locations.length > 0) {
    const visibleEntries = issueLocationDisplayEntries(locations, displayLimit);
    const hiddenCount = issueElementsExpanded ? 0 : Math.max(0, locations.length - visibleEntries.length);
    const groupedSections = issueEiGroupedChipSectionsMarkup(ctx, issue, dimensionName, visibleEntries, activeElementNumber);
    return `
      <div class="issue-summary-row issue-summary-row-elements">
        <div class="issue-phs-grouped-wrap issue-ei-grouped-wrap">
          ${groupedSections}
        </div>
        ${elementListToggleMarkup({ issue, dimensionName, hiddenCount, expanded: issueElementsExpanded, escapeHtml })}
      </div>
    `;
  }

  const fallbackEntries = [{
    location: {
      label: "Structural evidence, not directly highlightable",
      highlightable: false,
      status: "No visible target found",
    },
    elementNumber: 1,
  }];
  const shownEntries = locations.length ? issueLocationDisplayEntries(locations, displayLimit) : fallbackEntries;
  const hiddenCount = locations.length && !issueElementsExpanded ? Math.max(0, locations.length - shownEntries.length) : 0;
  const shownLocations = shownEntries.map(({ location }) => location);
  if (dtLineageEnabled() && (issue?.rule_id || "") === "DT-1") {
    console.log("[DT-1 location lineage]", {
      stage: "grouped.issue.locations",
      ...summarizeDtLocationArray(shownLocations),
      dimension: dimensionName,
      hidden_count: hiddenCount,
    });
  }
  const chips = shownEntries.map(({ location, elementNumber }) => (
    issueElementChipRowMarkup(ctx, issue, dimensionName, location, elementNumber, activeElementNumber)
  )).join("");
  if (dtLineageEnabled() && (issue?.rule_id || "") === "DT-1") {
    console.log("[DT-1 location lineage]", {
      stage: "issue.template.output",
      dt_location_count: shownLocations.length,
      dt_location_ids: summarizeDtLocationArray(shownLocations).dt_location_ids,
      duplicate_selector_count: summarizeDtLocationArray(shownLocations).duplicate_selector_count,
      duplicate_text_count: summarizeDtLocationArray(shownLocations).duplicate_text_count,
      grouped_keys: [],
      collapsed_ids: [],
      surviving_ids: summarizeDtLocationArray(shownLocations).dt_location_ids,
      markup_length: chips.length,
      dimension: dimensionName,
    });
  }
  return `
    <div class="issue-summary-row issue-summary-row-elements">
      <div class="issue-element-chip-list">
        ${chips}
      </div>
      ${elementListToggleMarkup({ issue, dimensionName, hiddenCount, expanded: issueElementsExpanded, escapeHtml })}
    </div>
  `;
}

function issueSummaryCardMarkup(ctx, issueContext) {
  const { escapeHtml } = ctx;
  const {
    issue,
    dimensionName,
    issueNumber,
    selectedClass,
    cogaSummary,
    isoSummary,
    issueId,
    selectedIssueId,
    selectedElementNumber,
    issueElementsExpanded,
    issueElementsDisclosureOpen,
  } = issueContext;
  const cogaMarkup = cogaGuidanceMarkup({ summaryText: cogaSummary, escapeHtml });
  const isoMarkup = standardsPillsMarkup({ summaryText: isoSummary, fallbackText: "Effectiveness, efficiency, satisfaction.", escapeHtml });
  const openAttribute = issueElementsExpanded || issueElementsDisclosureOpen ? " open" : "";

  return `
    <details
      class="issue-highlight-button issue-summary-card${selectedClass}"
      data-highlight-issue="${escapeHtml(issue.rule_id)}"
      data-highlight-dimension="${escapeHtml(dimensionName)}"
      ${openAttribute}
    >
      <summary
        class="issue-summary-toggle"
        data-accessibility-tooltip="${escapeHtml(`Open guidance and affected elements for ${issue.title || "this issue"}.`)}"
      >
        <div class="issue-summary-topline">
          <span class="issue-highlight-rule">Issue ${issueNumber}</span>
          <span class="issue-summary-chevron" aria-hidden="true">▾</span>
        </div>
        <strong class="issue-summary-title">${escapeHtml(issue.title || "Review this issue")}</strong>
      </summary>
      <div class="issue-summary-body">
        <div class="issue-summary-row issue-summary-row-rationale">
          <details class="issue-rationale-details">
            <summary class="issue-rationale-summary">
              <span class="issue-rationale-label">Accessibility rationale</span>
              <span class="issue-rationale-arrow" aria-hidden="true"></span>
            </summary>
            <div class="issue-rationale-expand-wrap">
              <div class="issue-rationale-inner">
                <div class="issue-summary-row issue-summary-row-standards">
                  <span class="issue-highlight-label issue-highlight-label--wcag-guidance">WCAG Cognitive Accessibility Guidance</span>
                  ${cogaMarkup}
                </div>
                <div class="issue-summary-row issue-summary-row-standards">
                  <span class="issue-highlight-label">ISO 9241-11</span>
                  ${isoMarkup}
                </div>
              </div>
            </div>
          </details>
        </div>
        ${issueElementListMarkup(ctx, issue, dimensionName, selectedIssueId, selectedElementNumber, issueElementsExpanded)}
      </div>
    </details>
  `;
}

export {
  ISSUE_ELEMENT_DISPLAY_LIMIT,
  issueElementChipRowMarkup,
  issueElementListMarkup,
  issueSummaryCardMarkup,
};
