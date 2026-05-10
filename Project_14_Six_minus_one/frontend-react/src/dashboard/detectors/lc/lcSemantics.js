import { scParseMetricNumber, titleCaseSelectorPart } from "../shared/detectorCommon.js";

/** LC-1: same surface set as backend LANGUAGE_SELECTOR (p, li, td, th, label, button, a). */
const LC_TEXT_BLOCK_TAGS = new Set(["p", "li", "td", "th", "label", "button", "a"]);

function filterLcEvidenceElements(elements) {
  return elements.filter((el) => LC_TEXT_BLOCK_TAGS.has(el.tagName?.toLowerCase()));
}

function lcTextBlockPrimaryLabel(location) {
  const t = String(location?.tag || "").toLowerCase();
  const labels = {
    p: "Paragraph",
    li: "List item",
    td: "Table cell",
    th: "Table header cell",
    label: "Label",
    button: "Button",
    a: "Link",
  };
  if (labels[t]) {
    return labels[t];
  }
  return titleCaseSelectorPart(t || "text block");
}

/** LC-1 lexical metrics for chips / meta (API snake_case or camelCase). */
function lcLexicalEvidenceMetricsLine(location) {
  if (!location || typeof location !== "object") {
    return "";
  }
  const ratio = scParseMetricNumber(location.complex_word_ratio ?? location.complexWordRatio);
  const cw = scParseMetricNumber(location.complex_word_count ?? location.complexWordCount);
  const tw = scParseMetricNumber(location.word_count ?? location.wordCount);
  const parts = [];
  if (ratio !== null) {
    parts.push(`${Math.round(ratio * 100)}% complex-word ratio`);
  }
  if (cw !== null && tw !== null) {
    parts.push(`${Math.round(cw)}/${Math.round(tw)} words`);
  } else if (cw !== null) {
    parts.push(`${Math.round(cw)} complex words`);
  }
  return parts.join(" · ");
}

function lcCompactSampleWords(location) {
  const raw = location?.sample_words ?? location?.sampleWords;
  if (!Array.isArray(raw) || !raw.length) {
    return "";
  }
  const slice = raw.slice(0, 6);
  return `Examples: ${slice.join(", ")}`;
}

export {
  LC_TEXT_BLOCK_TAGS,
  filterLcEvidenceElements,
  lcCompactSampleWords,
  lcLexicalEvidenceMetricsLine,
  lcTextBlockPrimaryLabel,
};

