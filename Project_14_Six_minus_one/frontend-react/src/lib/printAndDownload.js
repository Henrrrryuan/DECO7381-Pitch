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
 *   issueCogaGuidanceTags: (ruleId: unknown) => string[],
 *   PATIENT_PROFILES?: Record<string, { label?: string, condition?: string, summary?: string, enabledDetectors?: string[], detectorOrder?: string[] }>,
 * }} PrintMarkupDeps
 */

export function printProfileLabels(result, deps = {}) {
  if (!result) {
    return [];
  }
  const { PATIENT_PROFILES } = deps;
  const profiles = PATIENT_PROFILES && typeof PATIENT_PROFILES === "object" ? PATIENT_PROFILES : {};
  const profileNames = Object.keys(profiles);
  return profileNames.length ? profileNames : ["Detectors"];
}

function canonicalDimensionName(name) {
  return String(name || "");
}

function profileDisplayLabel(profileName, deps) {
  const profile = deps.PATIENT_PROFILES?.[profileName] || {};
  return profile.condition || profile.label || profileName;
}

function isDetectorEnabledForProfile(name, profileName, deps) {
  const profile = deps.PATIENT_PROFILES?.[profileName] || {};
  const enabledDetectors = Array.isArray(profile.enabledDetectors) ? profile.enabledDetectors : [];
  return enabledDetectors.length ? enabledDetectors.includes(canonicalDimensionName(name)) : true;
}

function profileDimensionConfigs(profileName, deps) {
  const { DIMENSION_CONFIG } = deps;
  const profile = deps.PATIENT_PROFILES?.[profileName] || {};
  const detectorOrder = Array.isArray(profile.detectorOrder) ? profile.detectorOrder : [];
  const baseIndexByName = new Map(DIMENSION_CONFIG.map(({ name }, index) => [canonicalDimensionName(name), index]));
  return [...DIMENSION_CONFIG]
    .filter(({ name }) => isDetectorEnabledForProfile(name, profileName, deps))
    .sort((left, right) => {
      const leftIndex = detectorOrder.indexOf(canonicalDimensionName(left.name));
      const rightIndex = detectorOrder.indexOf(canonicalDimensionName(right.name));
      const normalizedLeft = leftIndex === -1
        ? 100000 + (baseIndexByName.get(canonicalDimensionName(left.name)) || 0)
        : leftIndex;
      const normalizedRight = rightIndex === -1
        ? 100000 + (baseIndexByName.get(canonicalDimensionName(right.name)) || 0)
        : rightIndex;
      return normalizedLeft - normalizedRight;
    });
}

export function printProfileDimensionRows(result, profileLabel, deps) {
  const { displayDimensionName } = deps;
  return profileDimensionConfigs(profileLabel, deps).map(({ name }) => {
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
  const { conciseText, pillListMarkup, issueIsoClauseTags, issueCogaGuidanceTags } = deps;
  const firstFix = conciseText(issue.suggestion, "Review this issue and simplify the interaction.", 180);
  const description = conciseText(issue.description, "This issue may increase cognitive effort for users.", 220);
  const cogaTags = typeof issueCogaGuidanceTags === "function"
    ? issueCogaGuidanceTags(issue.rule_id)
    : ["Help users focus"];
  return `
    <article class="print-issue-card">
      <div class="print-issue-card__meta">
        <span>Issue ${issueNumber}</span>
      </div>
      <h4>${escapeHtml(issue.title || "Review this issue")}</h4>
      <p>${escapeHtml(description)}</p>
      <p><strong>First fix:</strong> ${escapeHtml(firstFix)}</p>
      <div class="print-issue-card__standards">
        <span class="print-issue-card__standards-label">WCAG Cognitive Accessibility Guidance</span>
        ${pillListMarkup(cogaTags, 99, "coga")}
      </div>
      <div class="print-issue-card__tags">
        ${pillListMarkup(issueIsoClauseTags(issue.rule_id), 99, "iso")}
      </div>
    </article>
  `;
}

export function printProfileDimensionCards(result, profileLabel, deps) {
  const { displayDimensionName } = deps;
  let issueNumber = 0;
  return profileDimensionConfigs(profileLabel, deps).map(({ name }) => {
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

  const labels = printProfileLabels(result, deps);
  printProfileReport.innerHTML = labels.map((profileName) => `
    <section class="print-profile-section">
      <h2>${escapeHtml(profileDisplayLabel(profileName, deps))}</h2>
      ${deps.PATIENT_PROFILES?.[profileName]?.summary ? `<p class="print-profile-summary">${escapeHtml(deps.PATIENT_PROFILES[profileName].summary)}</p>` : ""}
      <div class="print-profile-risk-list">
        ${printProfileDimensionRows(result, profileName, deps)}
      </div>
      <div class="print-profile-dimension-list">
        ${printProfileDimensionCards(result, profileName, deps)}
      </div>
    </section>
  `).join("");
}

export function renderPrintSummary(result, deps) {
  const sourceNode = document.getElementById("printSourceName");
  const summaryNode = document.getElementById("printSummaryText");

  if (!sourceNode || !summaryNode) {
    return;
  }

  const { sourceName } = deps;

  sourceNode.textContent = sourceName || "Uploaded file";
  const totalIssues = (result?.dimensions || []).reduce(
    (count, dimension) => count + (dimension?.issues?.length || 0),
    0,
  );
  summaryNode.textContent = `${totalIssues} issue${totalIssues === 1 ? "" : "s"} detected in this report.`;
}
