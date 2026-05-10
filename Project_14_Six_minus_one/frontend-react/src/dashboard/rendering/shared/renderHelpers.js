function splitStandardItems(summaryText, fallbackText) {
  const source = String(summaryText || "").trim();
  const parts = source
    .split(/[;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (parts.length) {
    return parts;
  }
  return [fallbackText];
}

function standardsPillsMarkup({ summaryText, fallbackText, escapeHtml }) {
  const items = splitStandardItems(summaryText, fallbackText);
  return `
    <div class="issue-standards-list">
      ${items.map((item) => `<span class="issue-standard-pill">${escapeHtml(item)}</span>`).join("")}
    </div>
  `;
}

function cogaGuidanceMarkup({ summaryText, escapeHtml }) {
  const items = splitStandardItems(summaryText, "Help Users Focus");
  return `
    <div class="issue-standards-list">
      ${items.map((item) => `<span class="issue-standard-pill">${escapeHtml(item)}</span>`).join("")}
    </div>
  `;
}

export {
  cogaGuidanceMarkup,
  splitStandardItems,
  standardsPillsMarkup,
};

