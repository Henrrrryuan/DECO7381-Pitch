import { scParseMetricNumber } from "../shared/detectorCommon.js";

/** DT-1: same surface set as backend TEXT_BLOCK_SELECTOR (p, li, td, th). */
const DT_TEXT_BLOCK_TAGS = new Set(["p", "li", "td", "th"]);

function filterDtEvidenceElements(elements) {
  return elements.filter((el) => DT_TEXT_BLOCK_TAGS.has(el.tagName?.toLowerCase()));
}

/** DT-1 block metrics for chips / meta (word + punctuation-based fragment counts). */
function dtDenseEvidenceMetricsLine(location) {
  if (!location || typeof location !== "object") {
    return "";
  }
  const w = scParseMetricNumber(location.word_count ?? location.wordCount);
  const s = scParseMetricNumber(location.sentence_count ?? location.sentenceCount);
  const parts = [];
  if (w !== null) {
    parts.push(`${Math.round(w)} words`);
  }
  if (s !== null) {
    parts.push(`${Math.round(s)} sentence fragments`);
  }
  return parts.join(" · ");
}

export {
  DT_TEXT_BLOCK_TAGS,
  dtDenseEvidenceMetricsLine,
  filterDtEvidenceElements,
};

