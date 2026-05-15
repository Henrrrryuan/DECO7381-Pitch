function explanationAccordionBlockMarkup({
  displayNameEscaped,
  issueCount,
  summaryEscaped,
  issuesMarkup,
} = {}) {
  return `
      <details class="explanation-block explanation-accordion" data-explanation-dimension="${displayNameEscaped || ""}">
        <summary
          class="explanation-accordion-summary"
          data-accessibility-tooltip="Open this detector section to review its detected issues."
        >
          <span class="explanation-accordion-title">${displayNameEscaped || ""}</span>
          <span class="explanation-accordion-meta">
            <span class="explanation-accordion-issue-count">${Number(issueCount || 0)}</span>
            <span class="explanation-accordion-chevron" aria-hidden="true">▾</span>
          </span>
        </summary>
        <div class="explanation-accordion-content">
          ${issuesMarkup || ""}
        </div>
      </details>
    `;
}

export { explanationAccordionBlockMarkup };

