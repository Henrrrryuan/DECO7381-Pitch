function dashboardSummaryMarkup(totalIssues) {
  return `
    <div class="summary-line summary-issues">Total number of issues: ${Number(totalIssues || 0)} issues detected</div>
  `;
}

export { dashboardSummaryMarkup };

