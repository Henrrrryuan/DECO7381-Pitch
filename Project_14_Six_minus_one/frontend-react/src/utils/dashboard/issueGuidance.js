import {
  COGNITIVE_OBJECTIVES_BY_RULE,
  ISO_CLAUSES_BY_RULE,
  USER_LABELS_BY_RULE,
} from "./constants.js";
import { conciseText, displayDimensionName } from "./dashboardLabels.js";

// Issue guidance helpers.
//
// IssueDetailPanel.jsx uses this file to render explainable advice for the
// selected issue. The functions turn backend rule IDs, evidence, and locations
// into interview-friendly guidance such as standards mapping and fix steps.
export function issueFailingElementCount(issue) {
  const locations = Array.isArray(issue?.locations) ? issue.locations : [];
  return Math.max(1, locations.length || 0);
}

export function issueAffectedUserTags(ruleIdentifier) {
  return USER_LABELS_BY_RULE[ruleIdentifier] || ["Dyslexia users", "ADHD users", "Autistic users"];
}

export function issueIsoClauseTags(ruleIdentifier) {
  return ISO_CLAUSES_BY_RULE[ruleIdentifier] || ["6.3.3 Human effort expended"];
}

export function issueCognitiveObjective(ruleIdentifier) {
  return COGNITIVE_OBJECTIVES_BY_RULE[ruleIdentifier] || "Help Users Focus";
}

export function frameworkMappingCopy(ruleIdentifier) {
  const objective = issueCognitiveObjective(ruleIdentifier);
  return {
    coga: `COGA Objective: ${objective}`,
    iso: `ISO 9241-11: ${issueIsoClauseTags(ruleIdentifier).join("; ")}`,
    wcag: `Cognitive Accessibility Guidance: ${objective}`,
  };
}

export function recommendedFixSteps(issue, dimensionName) {
  const ruleIdentifier = issue?.rule_id || "";
  const displayName = displayDimensionName(dimensionName);
  if (ruleIdentifier.startsWith("RD") || displayName === "Readability") {
    return [
      { priority: "Must", text: "Rewrite the affected text into shorter, single-idea sentences." },
      { priority: "Should", text: "Replace dense or specialist wording with familiar terms where possible." },
      { priority: "Could", text: "Use headings, bullets, or spacing so readers can scan before reading in full." },
    ];
  }
  if (ruleIdentifier.startsWith("ID") || displayName === "Interaction & Distraction") {
    return [
      { priority: "Must", text: "Remove automatic interruptions, autoplay, or motion that starts before users choose it." },
      { priority: "Should", text: "Make overlays, chat prompts, and secondary actions user-triggered where possible." },
      { priority: "Could", text: "Keep the primary task visible and stable while users are reading or deciding." },
    ];
  }
  if (ruleIdentifier.startsWith("CS") || displayName === "Consistency") {
    return [
      { priority: "Must", text: "Use consistent headings, labels, and navigation patterns across related sections." },
      { priority: "Should", text: "Make the next step predictable before asking users to act." },
      { priority: "Could", text: "Avoid sudden layout or wording changes that force users to re-orient." },
    ];
  }
  return [
    { priority: "Must", text: "Choose one primary reading path or task for this area." },
    { priority: "Should", text: "Demote secondary banners, panels, media, or actions that compete with the main path." },
    { priority: "Could", text: "Use Show highlighted location to check the highlighted areas after redesigning the layout." },
  ];
}

export function issueGoalText(issue, dimensionName) {
  const displayName = displayDimensionName(dimensionName);
  if (displayName === "Readability") {
    return "Keep sentences easy to scan, with one clear message per line.";
  }
  if (displayName === "Interaction & Distraction") {
    return "Keep only essential motion and keep users in control of interruptions.";
  }
  if (displayName === "Consistency") {
    return "Make navigation and next actions predictable across the page.";
  }
  return "Reduce competing focal points and support one dominant task path.";
}

export function issueDoneWhenText(issue, dimensionName) {
  const displayName = displayDimensionName(dimensionName);
  if (displayName === "Readability") {
    return "Done when key passages are short, clear, and scannable without re-reading.";
  }
  if (displayName === "Interaction & Distraction") {
    return "Done when non-essential autoplay or pop-up interruptions are removed.";
  }
  if (displayName === "Consistency") {
    return "Done when repeated UI patterns use consistent labels and interaction flow.";
  }
  return "Done when one clear primary focus is visible above the fold.";
}

export function locationPrimaryText(location) {
  return location?.text
    || location?.preview
    || location?.sentence_preview
    || location?.label
    || location?.summary
    || location?.region
    || location?.html_snippet
    || location?.selector
    || "";
}

export function friendlyLocationLabel(location) {
  const technicalText = location?.summary || location?.region || location?.selector || location?.tag || "";
  if (technicalText) {
    return conciseText(
      String(technicalText).replace(/^[.#]/, "").replace(/[-_]+/g, " "),
      "Affected page area",
      72,
    );
  }
  return conciseText(locationPrimaryText(location), "Affected page area", 72);
}

export function locationMetaText(location) {
  if (location?.summary) {
    return `Location: ${location.summary}`;
  }
  if (location?.region) {
    return `Region: ${location.region}`;
  }
  if (location?.tag) {
    return `Element type: ${location.tag}`;
  }
  if (location?.selector) {
    return `Selector: ${location.selector}`;
  }
  return "Location detail";
}

export function getKeyLocations(issue, limit = 3) {
  const seenLabels = new Set();
  return (Array.isArray(issue?.locations) ? issue.locations : [])
    .map((location) => ({ location, label: friendlyLocationLabel(location) }))
    .filter(({ label }) => {
      const normalizedLabel = label.toLowerCase();
      if (seenLabels.has(normalizedLabel)) {
        return false;
      }
      seenLabels.add(normalizedLabel);
      return true;
    })
    .slice(0, limit);
}
