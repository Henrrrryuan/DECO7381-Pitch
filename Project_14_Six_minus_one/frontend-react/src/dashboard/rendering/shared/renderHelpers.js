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

function iso9241Description(item) {
  const label = String(item || "").trim().toLowerCase();
  if (label === "effectiveness") {
    return "whether users can accurately and completely achieve the intended goal.";
  }
  if (label === "efficiency") {
    return "how much time, effort, or cognitive work users need to complete the task.";
  }
  if (label === "satisfaction") {
    return "whether the experience feels comfortable, acceptable, and confidence-building.";
  }
  return "";
}

function standardPillMarkup(item, escapeHtml, className = "") {
  const description = className === "iso" ? iso9241Description(item) : "";
  if (!description) {
    return `<span class="issue-standard-pill">${escapeHtml(item)}</span>`;
  }
  return `
    <span class="issue-standard-pill issue-standard-pill--explained">
      <strong>${escapeHtml(item)}:</strong>
      <span>${escapeHtml(description)}</span>
    </span>
  `;
}

function standardsPillsMarkup({ summaryText, fallbackText, escapeHtml }) {
  const items = splitStandardItems(summaryText, fallbackText);
  return `
    <div class="issue-standards-list issue-standards-list--iso">
      ${items.map((item) => standardPillMarkup(item, escapeHtml, "iso")).join("")}
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
  iso9241Description,
  splitStandardItems,
  standardsPillsMarkup,
};

