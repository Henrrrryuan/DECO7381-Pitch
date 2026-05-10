function lccEvidenceMetricsLine(location) {
  const wordCount = Number(location?.word_count || 0);
  const headingCount = Number(location?.heading_count || 0);
  const listCount = Number(location?.list_count || 0);
  const paragraphCount = Number(location?.paragraph_count || 0);
  const parts = [];
  if (Number.isFinite(wordCount) && wordCount > 0) {
    parts.push(`${wordCount} words`);
  }
  if (Number.isFinite(headingCount)) {
    parts.push(`${headingCount} headings`);
  }
  if (Number.isFinite(listCount)) {
    parts.push(`${listCount} list items`);
  }
  if (Number.isFinite(paragraphCount) && paragraphCount > 0) {
    parts.push(`${paragraphCount} paragraphs`);
  }
  return parts.join(" · ");
}

export {
  lccEvidenceMetricsLine,
};

