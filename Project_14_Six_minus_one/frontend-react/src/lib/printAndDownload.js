/**
 * Printable report markup for the dashboard sidebar (#printSummary, #printProfileReport).
 * DOM targets stay stable with DashboardPage.jsx ids; callers supply dimension/issue helpers from dashboardApp.
 */

import { escapeHtml, findDimension } from "./common.js";

/**
 * @typedef {{
 *   DIMENSION_CONFIG: Array<{ name: string }>,
 *   displayDimensionName: (name: unknown) => string,
 *   sourceName: string,
 *   isDetectorEnabledForActiveProfile: (name: unknown) => boolean,
 *   conciseText: (text: unknown, fallback?: string, maxLength?: number) => string,
 *   pillListMarkup: (items: string[], limit?: number, className?: string) => string,
 *   issueIsoClauseTags: (ruleId: unknown) => string[],
 * }} PrintMarkupDeps
 */

export function printProfileLabels(result) {
  return result ? ["Detectors"] : [];
}

export function printProfileDimensionRows(result, profileLabel, deps) {
  const { DIMENSION_CONFIG, displayDimensionName, isDetectorEnabledForActiveProfile } = deps;
  return DIMENSION_CONFIG.filter(({ name }) => isDetectorEnabledForActiveProfile(name)).map(({ name }) => {
    const dimension = findDimension(result, name);
    const issueCount = dimension?.issues?.length || 0;
    return `
      <div class="print-profile-risk-row">
        <span>${escapeHtml(displayDimensionName(name))}</span>
        <span>${Number(issueCount || 0)} issue${Number(issueCount || 0) === 1 ? "" : "s"}</span>
      </div>
    `;
  }).join("");
}

export function printIssueCardMarkup(issue, dimensionName, issueNumber, deps) {
  const { conciseText, pillListMarkup, issueIsoClauseTags } = deps;
  const firstFix = conciseText(issue.suggestion, "Review this issue and simplify the interaction.", 180);
  const description = conciseText(issue.description, "This issue may increase cognitive effort for users.", 220);
  const conf = issue.interpretation?.confidence || issue.issue_object?.interpretation?.confidence;
  const metaRight = conf ? `Confidence: ${conf}` : "Heuristic finding";
  return `
    <article class="print-issue-card">
      <div class="print-issue-card__meta">
        <span>Issue ${issueNumber}</span>
        <span>${escapeHtml(metaRight)}</span>
      </div>
      <h4>${escapeHtml(issue.title || "Review this issue")}</h4>
      <p>${escapeHtml(description)}</p>
      <p><strong>First fix:</strong> ${escapeHtml(firstFix)}</p>
      <div class="print-issue-card__tags">
        ${pillListMarkup(issueIsoClauseTags(issue.rule_id), 99, "iso")}
      </div>
    </article>
  `;
}

export function printProfileDimensionCards(result, profileLabel, deps) {
  const { DIMENSION_CONFIG, displayDimensionName } = deps;
  let issueNumber = 0;
  return DIMENSION_CONFIG.map(({ name }) => {
    const dimension = findDimension(result, name);
    const issues = dimension?.issues || [];
    const issueCards = issues.map((issue) => {
      issueNumber += 1;
      return printIssueCardMarkup(issue, dimension?.dimension || name, issueNumber, deps);
    }).join("");
    return `
      <details class="print-profile-dimension-card" open>
        <summary>
          <span>${escapeHtml(displayDimensionName(name))}</span>
          <strong>${issues.length}</strong>
        </summary>
        <div class="print-profile-dimension-body">
          ${issues.length ? issueCards : `<p class="print-empty-note">No triggered issue for this profile in this detector.</p>`}
        </div>
      </details>
    `;
  }).join("");
}

export function renderPrintableProfileReport(result, deps) {
  const printProfileReport = document.getElementById("printProfileReport");
  if (!printProfileReport) {
    return;
  }

  const labels = printProfileLabels(result);
  printProfileReport.innerHTML = labels.map((profileLabel) => `
    <section class="print-profile-section">
      <h2>${escapeHtml(profileLabel)}</h2>
      <div class="print-profile-risk-list">
        ${printProfileDimensionRows(result, profileLabel, deps)}
      </div>
      <div class="print-profile-dimension-list">
        ${printProfileDimensionCards(result, profileLabel, deps)}
      </div>
    </section>
  `).join("");
}

export function renderPrintSummary(result, deps) {
  const overallNode = document.getElementById("printOverallScore");
  const sourceNode = document.getElementById("printSourceName");
  const summaryNode = document.getElementById("printSummaryText");
  const dimensionNode = document.getElementById("printDimensionSummary");

  if (!overallNode || !sourceNode || !summaryNode || !dimensionNode) {
    return;
  }

  const { DIMENSION_CONFIG, displayDimensionName, sourceName } = deps;

  overallNode.textContent = String(result.overall_score);
  sourceNode.textContent = sourceName || "Uploaded file";
  summaryNode.textContent = [
    `Overall score ${result.overall_score}.`,
    `Lowest detector score ${result.min_dimension_score}.`,
    `${result.dimensions.reduce((count, dimension) => count + dimension.issues.length, 0)} issues detected in this report.`,
  ].filter(Boolean).join(" ");

  dimensionNode.innerHTML = DIMENSION_CONFIG.map(({ name }) => {
    const dimension = findDimension(result, name);
    const score = dimension ? dimension.score : 0;
    return `
      <article class="print-dimension-card">
        <span>${escapeHtml(displayDimensionName(name))}</span>
        <strong>${score}</strong>
      </article>
    `;
  }).join("");
}
