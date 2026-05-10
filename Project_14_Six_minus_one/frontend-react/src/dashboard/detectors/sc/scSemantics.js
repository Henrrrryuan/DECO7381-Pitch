import { scParseMetricNumber } from "../shared/detectorCommon.js";

const SC_TEXT_BLOCK_TAGS = new Set(["p", "li", "td", "th"]);

function filterScEvidenceElements(elements) {
  return elements.filter((el) => SC_TEXT_BLOCK_TAGS.has(el.tagName?.toLowerCase()));
}

/** Resolved SC-1 counts from snake_case or camelCase API shapes. */
function scSentenceMetricValues(location) {
  const w = scParseMetricNumber(location?.sentence_word_count ?? location?.sentenceWordCount);
  const c = scParseMetricNumber(location?.comma_count ?? location?.commaCount);
  const j = scParseMetricNumber(location?.conjunction_count ?? location?.conjunctionCount);
  return { w, c, j };
}

/** True only when none of the three metrics coerced successfully (0 counts still count as present). */
function scAllThreeSentenceMetricsAbsent(location) {
  const { w, c, j } = scSentenceMetricValues(location);
  return w === null && c === null && j === null;
}

/** SC preview: word boundaries only — head + final tail on two lines (no char slicing). */
const SC_PREVIEW_HEAD_WORDS = 5;
const SC_PREVIEW_TAIL_WORDS = 5;
const SC_PREVIEW_SHORT_WORD_CAP = 12;
const SC_PREVIEW_SHORT_CHAR_CAP = 90;

/**
 * SC-1 fingerprint: `${first 5 words} …\n${last 5 words}` when long; else full sentence.
 * Tail is always the true sentence ending (consequence / outcome). Chips/guidance: pre-line CSS.
 * locationMetaText: flatten with .replace(/\n/g, " ").
 */
function scCompressedSentencePreview(raw) {
  const normalized = String(raw || "")
    .replace(/\r?\n/g, " ")
    .replace(/[\u201C\u201D\u2018\u2019"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return "";
  }
  const words = normalized.split(" ").filter(Boolean);
  if (words.length <= SC_PREVIEW_SHORT_WORD_CAP || normalized.length <= SC_PREVIEW_SHORT_CHAR_CAP) {
    return normalized;
  }
  const headN = SC_PREVIEW_HEAD_WORDS;
  const tailN = SC_PREVIEW_TAIL_WORDS;
  if (words.length <= headN + tailN) {
    return normalized;
  }
  const headPart = words.slice(0, headN).join(" ");
  const tailPart = words.slice(-tailN).join(" ");
  return `${headPart} …\n${tailPart}`;
}

/** SC-1: sentence-level heuristic counts for chip/guidance (detector-aligned fields). */
function scSentenceEvidenceMetricsLine(location) {
  if (!location || typeof location !== "object") {
    return "";
  }
  const { w, c, j } = scSentenceMetricValues(location);
  const parts = [];
  if (w !== null) {
    parts.push(`${Math.round(w)} words`);
  }
  if (c !== null) {
    parts.push(`${Math.round(c)} commas`);
  }
  if (j !== null) {
    parts.push(`${Math.round(j)} conjunctions`);
  }
  return parts.join(" · ");
}

/** Mirrors backend SC-1 thresholds — SC UI pattern badges only (detector unchanged). */
const SC_UI_WORD_THRESHOLD = 25;
const SC_UI_COMMA_THRESHOLD = 3;
const SC_UI_CONJUNCTION_THRESHOLD = 3;

function scSentenceTooLong(location) {
  const v = scParseMetricNumber(location?.sentence_word_count ?? location?.sentenceWordCount);
  return v !== null && v > SC_UI_WORD_THRESHOLD;
}

function scCommaDensityHigh(location) {
  const v = scParseMetricNumber(location?.comma_count ?? location?.commaCount);
  return v !== null && v > SC_UI_COMMA_THRESHOLD;
}

function scConjunctionDensityHigh(location) {
  const v = scParseMetricNumber(location?.conjunction_count ?? location?.conjunctionCount);
  return v !== null && v > SC_UI_CONJUNCTION_THRESHOLD;
}

/** SC-1 UI: one primary bucket per location (long > comma > conjunction > other). */
const SC_PRIMARY_GROUP_KEYS = ["long_sentences", "comma_density", "conjunction_density", "other"];

const SC_PRIMARY_GROUP_LABELS = {
  long_sentences: { chip: "Long sentence", heading: "Long Sentences" },
  comma_density: { chip: "Heavy comma density", heading: "Heavy Comma Density" },
  conjunction_density: { chip: "Complex conjunction chain", heading: "Complex Conjunction Chains" },
  other: { chip: "Other sentence complexity", heading: "Other sentence complexity" },
};

function scPrimaryPatternKey(location) {
  if (scSentenceTooLong(location)) {
    return "long_sentences";
  }
  if (scCommaDensityHigh(location)) {
    return "comma_density";
  }
  if (scConjunctionDensityHigh(location)) {
    return "conjunction_density";
  }
  return "other";
}

/** Primary pattern label for chips (singular / sentence case). */
function scPrimaryPattern(location) {
  const key = scPrimaryPatternKey(location);
  return SC_PRIMARY_GROUP_LABELS[key]?.chip ?? SC_PRIMARY_GROUP_LABELS.other.chip;
}

/** Heuristics that also matched but are not the primary bucket (for subdued chip/guidance line). */
function scSecondaryPatterns(location) {
  const primary = scPrimaryPatternKey(location);
  const secondary = [];
  if (primary !== "long_sentences" && scSentenceTooLong(location)) {
    secondary.push("Long sentence");
  }
  if (primary !== "comma_density" && scCommaDensityHigh(location)) {
    secondary.push("Heavy comma density");
  }
  if (primary !== "conjunction_density" && scConjunctionDensityHigh(location)) {
    secondary.push("Complex conjunction chain");
  }
  return secondary;
}

/**
 * Groups SC locations by primary pattern only (one chip per location, no duplicate groups).
 * elementNumber is 1-based index into issue.locations (highlight parity).
 */
function groupScLocationsByPrimaryPattern(locations) {
  const groups = {
    long_sentences: [],
    comma_density: [],
    conjunction_density: [],
    other: [],
  };
  if (!Array.isArray(locations)) {
    return groups;
  }
  locations.forEach((location, index) => {
    const key = scPrimaryPatternKey(location);
    groups[key].push({ location, elementNumber: index + 1 });
  });
  return groups;
}

export {
  SC_PRIMARY_GROUP_KEYS,
  SC_PRIMARY_GROUP_LABELS,
  SC_TEXT_BLOCK_TAGS,
  SC_UI_COMMA_THRESHOLD,
  SC_UI_CONJUNCTION_THRESHOLD,
  SC_UI_WORD_THRESHOLD,
  filterScEvidenceElements,
  groupScLocationsByPrimaryPattern,
  scAllThreeSentenceMetricsAbsent,
  scCompressedSentencePreview,
  scPrimaryPattern,
  scSecondaryPatterns,
  scSentenceEvidenceMetricsLine,
  scSentenceMetricValues,
};

