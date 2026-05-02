import {
  INFORMATION_OVERLOAD_NAME,
  LEGACY_INFORMATION_OVERLOAD_NAME,
  PROFILE_DISPLAY_CONFIG,
} from "./constants.js";

// Dashboard naming helpers.
//
// Components use these functions whenever backend names need to become stable
// user-facing labels. This keeps terms like "Visual Complexity" and
// "Information Overload" consistent across the sidebar, guidance, and preview.
export function normalizeProfileLabel(profileLabel) {
  const text = String(profileLabel || "").toLowerCase();
  if (text.includes("adhd") || text.includes("attention")) {
    return "ADHD";
  }
  if (text.includes("autism") || text.includes("autistic")) {
    return "Autism";
  }
  return "Dyslexia";
}

export function displayDimensionName(dimensionName) {
  return dimensionName === LEGACY_INFORMATION_OVERLOAD_NAME
    ? INFORMATION_OVERLOAD_NAME
    : dimensionName;
}

export function canonicalDimensionName(dimensionName) {
  return displayDimensionName(dimensionName);
}

export function displayIssueCategoryName(dimensionName) {
  const normalizedDimensionName = displayDimensionName(dimensionName);
  if (normalizedDimensionName === INFORMATION_OVERLOAD_NAME) {
    return "Information Overload Issue";
  }
  if (normalizedDimensionName === "Readability") {
    return "Readability Issue";
  }
  if (normalizedDimensionName === "Interaction & Distraction") {
    return "Interaction & Distraction Issue";
  }
  if (normalizedDimensionName === "Consistency") {
    return "Consistency & Predictability Issue";
  }
  return `${normalizedDimensionName} Issue`;
}

export function displayIssueCategorySingular(issue, dimensionName) {
  const rulePrefix = String(issue?.rule_id || "").split("-")[0];
  if (rulePrefix === "RD") {
    return "Readability Issue";
  }
  if (rulePrefix === "ID") {
    return "Interaction & Distraction Issue";
  }
  if (rulePrefix === "CS") {
    return "Consistency & Predictability Issue";
  }
  return displayDimensionName(dimensionName) === "Readability"
    ? "Readability Issue"
    : displayDimensionName(dimensionName) === "Interaction & Distraction"
      ? "Interaction & Distraction Issue"
      : displayDimensionName(dimensionName) === "Consistency"
        ? "Consistency & Predictability Issue"
        : "Information Overload Issue";
}

export function getCognitiveDimensionLabel(dimensionName) {
  const displayName = displayDimensionName(dimensionName);
  if (displayName === INFORMATION_OVERLOAD_NAME) {
    return "Information Filtering / Visual Prioritisation";
  }
  if (displayName === "Readability") {
    return "Reading Load / Comprehension";
  }
  if (displayName === "Interaction & Distraction") {
    return "Attention Regulation / Task Continuity";
  }
  if (displayName === "Consistency") {
    return "Predictability / Wayfinding";
  }
  return "Cognitive accessibility";
}

export function getProfileDisplayMeta(profileName) {
  const profileMeta = PROFILE_DISPLAY_CONFIG[profileName];
  if (profileMeta) {
    return profileMeta;
  }
  return {
    label: normalizeProfileLabel(profileName),
    subtitle: "Audience lens",
    weights: {},
  };
}

export function displayProfileName(profileName) {
  return getProfileDisplayMeta(profileName).label;
}

export function conciseText(text, fallbackText = "", maximumLength = 140) {
  const normalizedText = String(text || fallbackText || "").replace(/\s+/g, " ").trim();
  if (normalizedText.length <= maximumLength) {
    return normalizedText;
  }
  return `${normalizedText.slice(0, Math.max(0, maximumLength - 3)).trim()}...`;
}

export function isProbablyWebsiteAddress(value) {
  return /^https?:\/\//i.test(String(value || ""));
}
