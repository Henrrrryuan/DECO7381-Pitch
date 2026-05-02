import { HIGHLIGHT_SETTINGS_BY_DIMENSION } from "./constants.js";
import {
  displayDimensionName,
  isProbablyWebsiteAddress,
} from "./dashboardLabels.js";

// Preview and highlight helpers.
//
// WebsitePreviewPanel.jsx uses this module to build the iframe document and to
// decide which selectors should be highlighted for a selected issue or
// dimension. The actual React component stays focused on iframe lifecycle.
export function buildPreviewHtml(htmlContent) {
  const baseMarkup = "\n<base href=\"about:srcdoc\">\n";
  const source = String(htmlContent || "");
  if (/<head[\s>]/i.test(source)) {
    return source.replace(/<head([^>]*)>/i, `<head$1>${baseMarkup}`);
  }
  return `${baseMarkup}${source}`;
}

export function getPreviewFrameAddress(sourceUrl) {
  return isProbablyWebsiteAddress(sourceUrl)
    ? `/eye/proxy?url=${encodeURIComponent(sourceUrl)}`
    : "";
}

export function getHighlightSettings(dimensionName) {
  return HIGHLIGHT_SETTINGS_BY_DIMENSION[displayDimensionName(dimensionName)]
    || HIGHLIGHT_SETTINGS_BY_DIMENSION["Information Overload"];
}

export function getFallbackSelectorsForIssue(issue, dimensionName) {
  const ruleIdentifier = issue?.rule_id || "";
  if (ruleIdentifier === "IO-1") {
    return ["main > *", "header > *", "section", "article", "nav", "button", "a", "img", "h1", "h2"];
  }
  if (ruleIdentifier === "IO-2") {
    return ["section", "article", "ul", "ol", ".card", "[class*='card' i]", "[class*='grid' i]"];
  }
  if (ruleIdentifier === "IO-3") {
    return ["aside", "[class*='sidebar' i]", "[class*='banner' i]", "[class*='promo' i]", "[class*='support' i]"];
  }
  if (ruleIdentifier === "IO-4") {
    return ["button", "a", "[role='button']", "[class*='cta' i]", "[class*='primary' i]", "[class*='hero' i]", "[class*='btn' i]"];
  }
  if (ruleIdentifier.startsWith("RD")) {
    return ["p", "li", "article", "section", "label", "legend", "small", "button", "a"];
  }
  if (ruleIdentifier.startsWith("ID")) {
    return HIGHLIGHT_SETTINGS_BY_DIMENSION["Interaction & Distraction"].selectors;
  }
  if (ruleIdentifier.startsWith("CS")) {
    return HIGHLIGHT_SETTINGS_BY_DIMENSION.Consistency.selectors;
  }
  return getHighlightSettings(dimensionName).selectors;
}
