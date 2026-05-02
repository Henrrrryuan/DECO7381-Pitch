import {
  COGNITIVE_OBJECTIVES_BY_RULE,
  COGA_GUIDANCE_BY_RULE,
  ISO_CLAUSES_BY_RULE,
  USER_LABELS_BY_RULE,
  WCAG_CRITERIA_BY_RULE,
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

export function issueWcagCriteriaTags(ruleIdentifier) {
  return WCAG_CRITERIA_BY_RULE[ruleIdentifier] || ["SC 2.4.6 Headings and Labels"];
}

export function issueCognitiveObjective(ruleIdentifier) {
  return COGNITIVE_OBJECTIVES_BY_RULE[ruleIdentifier] || "Help Users Focus";
}

export function frameworkMappingCopy(ruleIdentifier) {
  return {
    coga: COGA_GUIDANCE_BY_RULE[ruleIdentifier] || "COGA: reduce cognitive load in task flow",
    iso: `ISO 9241-11:2018 ${issueIsoClauseTags(ruleIdentifier).join("; ")}`,
    wcag: `WCAG 2.2 ${issueWcagCriteriaTags(ruleIdentifier).join("; ")}`,
  };
}

export function issueCardStandardsSummary(ruleIdentifier) {
  return {
    wcag: issueWcagCriteriaTags(ruleIdentifier).join("; "),
    iso: issueIsoClauseTags(ruleIdentifier).join("; "),
  };
}

function cleanIssueSuggestion(issue) {
  return String(issue?.suggestion || "").trim();
}

function issueRuleFixStepText(issue, dimensionName) {
  const ruleIdentifier = issue?.rule_id || "";
  const displayName = displayDimensionName(dimensionName);
  const backendSuggestion = cleanIssueSuggestion(issue);

  const ruleSteps = {
    "RD-1": [
      "Split long sentences into shorter, direct statements.",
      "Keep each sentence focused on one main idea.",
    ],
    "RD-2": [
      "Break long paragraphs or list items into smaller chunks.",
      "Add subheadings, lists, or spacing so readers can scan before reading in full.",
    ],
    "RD-3": [
      "Replace vague labels with specific action labels that state what will happen.",
      "Use labels such as \"View event details\" or \"Continue to payment\" instead of \"Click here\" or \"Learn more\".",
    ],
    "RD-4": [
      "Replace dense or specialist words with familiar terms where possible.",
      "Keep necessary technical terms, but explain them in plain language.",
    ],
    "RD-5": [
      "Rewrite instructions as short, direct steps.",
      "Separate conditions or exceptions into small, easy-to-scan chunks.",
    ],
    "RD-6": [
      "Break long prose into smaller grouped chunks.",
      "Use lists, short sub-sections, or clearly separated steps to reduce scanning effort.",
    ],
    "IO-1": [
      "Choose one primary reading path or task for the first screen.",
      "Reduce or demote competing headings, media, panels, and calls to action.",
    ],
    "IO-2": [
      "Split the dense region into smaller chunks.",
      "Reveal secondary content progressively instead of showing every item at once.",
    ],
    "IO-3": [
      "Demote or remove non-essential side panels and promotional blocks.",
      "Keep supporting content visually quieter than the main reading path.",
    ],
    "IO-4": [
      "Make one primary call to action visually dominant.",
      "Group secondary actions together so users do not compare too many same-level choices.",
    ],
    "IO-5": [
      "Strengthen one top-level heading and one obvious next step.",
      "Reduce competing headings or equally prominent actions near the start of the page.",
    ],
    "ID-1": [
      "Disable autoplay by default.",
      "Use a user-initiated play control when motion or media is part of the main task.",
    ],
    "ID-2": [
      "Reduce non-essential motion and continuously moving components.",
      "Keep each main region to only one or two animated elements where motion is necessary.",
    ],
    "ID-3": [
      "Avoid showing popups, sticky prompts, or overlay CTAs on initial load.",
      "Keep optional prompts collapsed until the user asks for them.",
    ],
    "CS-1": [
      "Add one clear h1 that describes the page purpose.",
      "Use lower-level headings in order to mark major sections.",
    ],
    "CS-2": [
      "Add breadcrumbs or mark the active navigation item.",
      "Use aria-current where it helps users confirm their current location.",
    ],
    "CS-3": [
      "Add progress text such as \"Step 2 of 4\" or a visible stepper.",
      "Keep the active step clearly marked before users continue.",
    ],
    "CS-4": [
      "Use a specific document title and descriptive h1.",
      "Add a short introductory cue that explains the page purpose or primary task.",
    ],
    "CS-5": [
      "Provide a clear primary navigation landmark.",
      "Label multiple navigation regions and keep link names specific.",
    ],
    "CS-6": [
      "Add a clearly labelled search landmark or search field.",
      "Pair the search input with a clear search submit button.",
    ],
    "CS-7": [
      "Give every control a clear accessible name.",
      "Connect tabs, accordions, menus, or expand controls to the content they affect.",
    ],
    "CS-8": [
      "Use one consistent label for each repeated action pattern.",
      "Avoid switching terms for the same action across the page.",
    ],
  };
  const fallbackSteps = {
    Readability: [
      "Rewrite the affected content so it is shorter and easier to scan.",
      "Use familiar wording and clear structure around the affected area.",
    ],
    "Interaction & Distraction": [
      "Remove automatic interruptions or motion that starts before users choose it.",
      "Keep the primary task visible and stable while users are reading or deciding.",
    ],
    Consistency: [
      "Make headings, labels, and navigation patterns consistent.",
      "Make the next step predictable before asking users to act.",
    ],
    "Information Overload": [
      "Choose one primary reading path or task for this area.",
      "Demote secondary banners, panels, media, or calls to action that compete with it.",
    ],
  };
  const selectedSteps = ruleSteps[ruleIdentifier] || fallbackSteps[displayName] || fallbackSteps["Information Overload"];
  const steps = backendSuggestion
    ? [backendSuggestion, ...selectedSteps.filter((step) => step !== backendSuggestion)]
    : selectedSteps;
  return steps.slice(0, 2);
}

export function recommendedFixSteps(issue, dimensionName) {
  return issueRuleFixStepText(issue, dimensionName).map((text, stepIndex) => ({
    priority: stepIndex === 0 ? "Must" : "Should",
    text,
  }));
}

export function issueGoalText(issue, dimensionName) {
  const ruleIdentifier = issue?.rule_id || "";
  const displayName = displayDimensionName(dimensionName);
  const goals = {
    "RD-1": "Make each sentence short enough to understand without re-reading.",
    "RD-2": "Turn dense text blocks into smaller, scannable chunks.",
    "RD-3": "Make every action label clearly describe the next result.",
    "RD-4": "Use familiar wording that users can decode quickly.",
    "RD-5": "Make instructions direct, sequential, and easy to scan.",
    "RD-6": "Break long prose into clear sections that users can scan.",
    "IO-1": "Reduce competing focal points and support one dominant task path.",
    "IO-2": "Reduce the amount users must compare in one region.",
    "IO-3": "Keep the main reading path stronger than supporting content.",
    "IO-4": "Make one primary action clearly more important than secondary actions.",
    "IO-5": "Make the page purpose and first next step obvious.",
    "ID-1": "Keep media under user control instead of starting automatically.",
    "ID-2": "Use motion only when it supports the current task.",
    "ID-3": "Avoid interruptions before users finish the main reading or task path.",
    "CS-1": "Create a predictable heading hierarchy.",
    "CS-2": "Make the current page location visible.",
    "CS-3": "Make multi-step progress visible and predictable.",
    "CS-4": "Make the page purpose clear before users act.",
    "CS-5": "Make navigation landmarks and link groups easy to recognise.",
    "CS-6": "Make search easy to find and understand.",
    "CS-7": "Make controls announce what they affect.",
    "CS-8": "Use stable wording for repeated actions.",
  };
  if (goals[ruleIdentifier]) {
    return goals[ruleIdentifier];
  }
  if (displayName === "Readability") {
    return "Make the affected content easier to read and scan.";
  }
  if (displayName === "Interaction & Distraction") {
    return "Keep users in control of motion and interruptions.";
  }
  if (displayName === "Consistency") {
    return "Make navigation, labels, and next actions predictable.";
  }
  return "Reduce competing focal points and support one dominant task path.";
}

export function issueDoneWhenText(issue, dimensionName) {
  const ruleIdentifier = issue?.rule_id || "";
  const displayName = displayDimensionName(dimensionName);
  const checks = {
    "RD-1": "Done when each sentence communicates one idea without forcing re-reading.",
    "RD-2": "Done when long text is split into shorter chunks with clear scan points.",
    "RD-3": "Done when each button or link can be understood without surrounding context.",
    "RD-4": "Done when key wording is familiar or briefly explained.",
    "RD-5": "Done when instructions can be followed step by step without rereading conditions.",
    "RD-6": "Done when users can scan section headings or chunks before reading in full.",
    "IO-1": "Done when one clear primary focus is visible above the fold.",
    "IO-2": "Done when users do not need to compare many same-level items at once.",
    "IO-3": "Done when side content no longer competes with the main reading path.",
    "IO-4": "Done when the primary action is visually dominant and secondary actions are grouped.",
    "IO-5": "Done when the page purpose and next step are clear on first scan.",
    "ID-1": "Done when media starts only after the user chooses it.",
    "ID-2": "Done when non-essential motion is removed or reduced.",
    "ID-3": "Done when popups or sticky prompts no longer interrupt the first task path.",
    "CS-1": "Done when headings follow a clear order from the main page heading down.",
    "CS-2": "Done when users can tell where they are in the site or flow.",
    "CS-3": "Done when the current step and remaining progress are visible.",
    "CS-4": "Done when title, heading, and intro all describe the same page purpose.",
    "CS-5": "Done when primary navigation is easy to find and each nav group is labelled.",
    "CS-6": "Done when search has a clear label and action.",
    "CS-7": "Done when each control name and affected content relationship is clear.",
    "CS-8": "Done when repeated actions use the same wording everywhere.",
  };
  if (checks[ruleIdentifier]) {
    return checks[ruleIdentifier];
  }
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
