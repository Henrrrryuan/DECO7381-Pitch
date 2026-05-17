/**
 * Printable report markup for the dashboard sidebar (#printSummary, #printProfileReport).
 * DOM targets stay stable with DashboardPage.jsx ids; callers supply dimension/issue helpers from dashboardApp.
 */

import { escapeHtml, findDimension } from "./common.js";
import {
  getHeatmapEvidenceSummary,
  getOverallEvidenceRisk,
  getRiskDrivers,
} from "./eyeEvidenceSummary.js";

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
 *   friendlyLocationLabel: (location: Record<string, unknown>, ruleId?: string) => string,
 *   locationMetaText: (location: Record<string, unknown>, elementNumber?: number, ruleId?: string) => string,
 *   PATIENT_PROFILES?: Record<string, { label?: string, condition?: string, summary?: string, enabledDetectors?: string[], detectorOrder?: string[] }>,
 *   eyeTrackingSummary?: { available?: boolean, coverage_percent?: number, sample_count?: number, duration_ms?: number, attention_summary?: Array<Record<string, unknown>>, eye_evidence?: Record<string, unknown> } | null,
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
  return profile.label || profile.condition || profileName;
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
  return profileDimensionConfigs(profileLabel, deps)
    .map(({ name }) => {
      const dimension = findDimension(result, name);
      const issueCount = dimension?.issues?.length || 0;
      if (!issueCount) {
        return "";
      }
      return `
      <div class="print-profile-risk-row">
        <span>${escapeHtml(displayDimensionName(name))}</span>
        <span>${Number(issueCount || 0)} issue${Number(issueCount || 0) === 1 ? "" : "s"}</span>
      </div>
    `;
    })
    .join("");
}

function printIssueElementsMarkup(issue, deps) {
  const locations = Array.isArray(issue?.locations) ? issue.locations : [];
  if (!locations.length) {
    return "";
  }
  const friendlyLocationLabel = typeof deps.friendlyLocationLabel === "function"
    ? deps.friendlyLocationLabel
    : () => "Affected page area";
  const locationMetaText = typeof deps.locationMetaText === "function"
    ? deps.locationMetaText
    : () => "Location detail";
  const items = locations.slice(0, 8).map((location, index) => {
    const elementNumber = index + 1;
    const label = friendlyLocationLabel(location, issue?.rule_id || "");
    const meta = locationMetaText(location, elementNumber, issue?.rule_id || "")
      .replace(/^Location: /, "")
      .replace(/\s+/g, " ")
      .trim();
    return `
      <li class="print-issue-element">
        <strong>Element ${elementNumber}: ${escapeHtml(label)}</strong>
        <span>${escapeHtml(meta || "Detected page evidence.")}</span>
      </li>
    `;
  }).join("");
  const extraCount = Math.max(0, locations.length - 8);
  return `
    <div class="print-issue-elements">
      <span class="print-issue-card__standards-label">Affected elements</span>
      <ol>
        ${items}
      </ol>
      ${extraCount ? `<p class="print-issue-elements-more">+ ${extraCount} more affected element${extraCount === 1 ? "" : "s"}.</p>` : ""}
    </div>
  `;
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
        <span class="print-issue-card__standards-label">ISO 9241-11</span>
        ${pillListMarkup(issueIsoClauseTags(issue.rule_id), 99, "iso")}
      </div>
      ${printIssueElementsMarkup(issue, deps)}
    </article>
  `;
}

export function printProfileDimensionCards(result, profileLabel, deps) {
  const { displayDimensionName } = deps;
  let issueNumber = 0;
  return profileDimensionConfigs(profileLabel, deps)
    .map(({ name }) => {
      const dimension = findDimension(result, name);
      const issues = dimension?.issues || [];
      if (!issues.length) {
        return "";
      }
      const issueCards = issues.map((issue) => {
        issueNumber += 1;
        return printIssueCardMarkup(issue, dimension?.dimension || name, issueNumber, deps);
      }).join("");
      return `
      <details class="print-profile-dimension-card" open>
        <summary>
          <span>${escapeHtml(displayDimensionName(name))}</span>
        </summary>
        <div class="print-profile-dimension-body">
          ${issues.length ? issueCards : `<p class="print-empty-note">No triggered issue for this profile in this detector.</p>`}
        </div>
      </details>
    `;
    })
    .join("");
}

function formatEyeMetric(value, suffix = "") {
  if (value === null || value === undefined || value === "") {
    return "Not recorded";
  }
  const number = Number(value);
  if (Number.isFinite(number)) {
    return `${number.toFixed(suffix === "%" ? 1 : 0)}${suffix}`;
  }
  return `${value}${suffix}`;
}

function printEyeTrackingReportMarkup(deps) {
  const summary = deps.eyeTrackingSummary || null;
  if (!summary?.available) {
    return "";
  }

  const riskDrivers = getRiskDrivers(summary);
  const eyeEvidence = summary.eye_evidence || {};
  const overallRisk = getOverallEvidenceRisk(riskDrivers, eyeEvidence);
  const narrative = getHeatmapEvidenceSummary(riskDrivers, eyeEvidence);
  const riskLabel = overallRisk ? `${overallRisk.charAt(0).toUpperCase()}${overallRisk.slice(1)} attention risk` : "Eye evidence available";
  const driverMarkup = riskDrivers.length
    ? riskDrivers.slice(0, 6).map((driver) => `
        <article class="print-eye-driver-card">
          <div class="print-eye-driver-header">
            <strong>${escapeHtml(driver.label || "Attention area")}</strong>
            <span class="print-eye-risk-pill is-${escapeHtml(driver.riskLevel || "medium")}">${escapeHtml(driver.riskLabel || "Risk")}</span>
          </div>
          <p>${escapeHtml(driver.interpretation || "Attention pattern needs review.")}</p>
          <p class="print-eye-driver-meta">
            Weighted share: ${escapeHtml(formatEyeMetric((Number(driver.weightedShare || 0) * 100), "%"))}
            ${driver.firstFixationMs !== null && driver.firstFixationMs !== undefined ? ` · First fixation: ${escapeHtml(formatEyeMetric(driver.firstFixationMs, "ms"))}` : ""}
          </p>
        </article>
      `).join("")
    : `<p class="print-empty-note">Eye tracking evidence was saved, but element-level attention data is not available.</p>`;

  return `
    <section class="print-eye-report">
      <div class="print-eye-report-header">
        <div>
          <p class="print-eye-report-kicker">Behavioral evidence</p>
          <h2>Eye Tracking Evidence</h2>
        </div>
        <span class="print-eye-risk-pill is-${escapeHtml(overallRisk || "medium")}">${escapeHtml(riskLabel)}</span>
      </div>
      <div class="print-eye-metrics">
        <div><span>Coverage</span><strong>${escapeHtml(formatEyeMetric(summary.coverage_percent, "%"))}</strong></div>
        <div><span>Samples</span><strong>${escapeHtml(formatEyeMetric(summary.sample_count))}</strong></div>
        <div><span>Duration</span><strong>${escapeHtml(formatEyeMetric(summary.duration_ms, "ms"))}</strong></div>
      </div>
      <div class="print-eye-summary">
        <p>${escapeHtml(narrative.overall)}</p>
        <p>${escapeHtml(narrative.risk)}</p>
        <p>${escapeHtml(narrative.priority)}</p>
      </div>
      <div class="print-eye-driver-list">
        ${driverMarkup}
      </div>
    </section>
  `;
}

export function renderPrintableProfileReport(result, deps) {
  const printProfileReport = document.getElementById("printProfileReport");
  if (!printProfileReport) {
    return;
  }

  const labels = printProfileLabels(result, deps);
  printProfileReport.innerHTML = `
    ${labels.map((profileName) => `
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
  `).join("")}
    ${printEyeTrackingReportMarkup(deps)}
  `;
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
