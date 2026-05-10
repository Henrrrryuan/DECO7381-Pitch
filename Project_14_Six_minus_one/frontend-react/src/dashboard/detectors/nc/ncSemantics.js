/** Mirrors `navigation_complexity.py` NAV_LINK_THRESHOLD / NAV_NESTING_THRESHOLD — NC UI grouping only. */
const NC_UI_NAV_LINK_THRESHOLD = 12;
const NC_UI_NAV_NESTING_THRESHOLD = 2;

function ncParseMetricInt(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function ncMetricLinkCount(location) {
  return ncParseMetricInt(location?.nav_link_count ?? location?.navLinkCount);
}

function ncMetricNestingDepth(location) {
  return ncParseMetricInt(location?.nesting_depth ?? location?.nestingDepth);
}

function ncNavHasTooManyLinks(location) {
  const n = ncMetricLinkCount(location);
  return n !== null && n > NC_UI_NAV_LINK_THRESHOLD;
}

function ncNavHasDeepNesting(location) {
  const d = ncMetricNestingDepth(location);
  return d !== null && d > NC_UI_NAV_NESTING_THRESHOLD;
}

/**
 * Groups NC locations into semantic violation buckets. Same nav may appear in both groups.
 * elementNumber is the 1-based index into issue.locations (highlight parity).
 */
function groupNcLocationsByViolation(locations) {
  const groups = {
    too_many_links: [],
    deep_nesting: [],
    other: [],
  };
  if (!Array.isArray(locations)) {
    return groups;
  }
  locations.forEach((location, index) => {
    const entry = { location, elementNumber: index + 1 };
    const manyLinks = ncNavHasTooManyLinks(location);
    const deepNest = ncNavHasDeepNesting(location);
    if (manyLinks) {
      groups.too_many_links.push(entry);
    }
    if (deepNest) {
      groups.deep_nesting.push(entry);
    }
    if (!manyLinks && !deepNest) {
      groups.other.push(entry);
    }
  });
  return groups;
}

const NC_GROUPED_METRICS_FALLBACK = "Link count · nesting depth unavailable";

/** Backend NC preview is metrics-only when sanitize ran — safe fallback when counts are absent from JSON. */
function ncMetricsLineFromPreviewFallback(location) {
  const preview = String(location?.preview || "").trim();
  if (!preview || /^navigation\s+region$/i.test(preview)) {
    return "";
  }
  // Matches backend NC preview, e.g. "14 navigation links · nesting depth 1"
  const hasLinksToken = /\d+\s+(?:navigation\s+)?links\b/i.test(preview);
  const hasNestingToken = /nesting\s+depth\s+\d+/i.test(preview);
  if (hasLinksToken || hasNestingToken) {
    return preview.replace(/\bnavigation\s+links\b/gi, "links");
  }
  return "";
}

/** NC-1 metrics line — coerces API/history string counts; no subtree text. */
function ncEvidenceMetricsLine(location) {
  if (!location || typeof location !== "object") {
    return "";
  }
  const linkCount = ncMetricLinkCount(location);
  const depth = ncMetricNestingDepth(location);
  const parts = [];
  if (linkCount !== null) {
    parts.push(`${linkCount} links`);
  }
  if (depth !== null) {
    parts.push(`nesting depth ${depth}`);
  }
  const fromFields = parts.join(" · ");
  if (fromFields) {
    return fromFields;
  }
  return ncMetricsLineFromPreviewFallback(location);
}

function ncTechnicalMetaLine(location) {
  if (!location || typeof location !== "object") {
    return "";
  }
  const selector = String(location.selector || "").trim();
  const summary = String(location.summary || "").trim();
  if (selector) {
    return selector;
  }
  return summary;
}

export {
  NC_GROUPED_METRICS_FALLBACK,
  NC_UI_NAV_LINK_THRESHOLD,
  NC_UI_NAV_NESTING_THRESHOLD,
  groupNcLocationsByViolation,
  ncEvidenceMetricsLine,
  ncTechnicalMetaLine,
};

