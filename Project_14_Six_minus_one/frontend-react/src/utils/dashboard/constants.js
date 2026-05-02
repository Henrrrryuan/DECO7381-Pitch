// Shared Dashboard constants.
//
// These values are imported by the smaller dashboard utility modules. Keeping
// them here prevents profile scoring, issue guidance, and preview highlighting
// from each defining their own copy of the same rule names and mappings.
export const DASHBOARD_HISTORY_CONTEXT_KEY = "cognilens.dashboard.history-context";
export const DASHBOARD_HISTORY_ONCE_KEY = "cognilens.dashboard.history-once";

export const INFORMATION_OVERLOAD_NAME = "Information Overload";
export const LEGACY_INFORMATION_OVERLOAD_NAME = "Visual Complexity";
export const DIMENSION_DISPLAY_ORDER = [
  INFORMATION_OVERLOAD_NAME,
  "Readability",
  "Interaction & Distraction",
  "Consistency",
];

export const PROFILE_DISPLAY_CONFIG = {
  "Reading Difficulties Lens": {
    label: "Dyslexia",
    subtitle: "Reading load sensitivity",
    weights: {
      [INFORMATION_OVERLOAD_NAME]: 0.35,
      Readability: 0.40,
      "Interaction & Distraction": 0.10,
      Consistency: 0.15,
    },
  },
  "Attention Regulation Lens": {
    label: "ADHD",
    subtitle: "Attention and distraction sensitivity",
    weights: {
      [INFORMATION_OVERLOAD_NAME]: 0.35,
      Readability: 0.10,
      "Interaction & Distraction": 0.35,
      Consistency: 0.20,
    },
  },
  "Autistic Support Lens": {
    label: "Autism",
    subtitle: "Predictability and sensory stability",
    weights: {
      [INFORMATION_OVERLOAD_NAME]: 0.20,
      Readability: 0.10,
      "Interaction & Distraction": 0.25,
      Consistency: 0.45,
    },
  },
};

export const DIMENSION_CONFIG = [
  { name: INFORMATION_OVERLOAD_NAME, className: "visual" },
  { name: "Readability", className: "readability" },
  { name: "Interaction & Distraction", className: "interaction" },
  { name: "Consistency", className: "consistency" },
];

export const SEVERITY_RANK = {
  critical: 3,
  major: 2,
  minor: 1,
};

export const USER_LABELS_BY_RULE = {
  "IO-1": ["Dyslexia users", "ADHD users"],
  "IO-2": ["Dyslexia users", "ADHD users"],
  "IO-3": ["ADHD users", "Autistic users"],
  "IO-4": ["ADHD users", "Autistic users"],
  "IO-5": ["Dyslexia users", "ADHD users", "Autistic users"],
  "RD-1": ["Dyslexia users"],
  "RD-2": ["Dyslexia users", "ADHD users"],
  "RD-3": ["Dyslexia users", "ADHD users", "Autistic users"],
  "RD-4": ["Dyslexia users"],
  "RD-5": ["Dyslexia users", "ADHD users", "Autistic users"],
  "RD-6": ["Dyslexia users", "ADHD users"],
  "ID-1": ["ADHD users", "Autistic users"],
  "ID-2": ["ADHD users", "Autistic users"],
  "ID-3": ["ADHD users", "Autistic users"],
  "CS-1": ["Dyslexia users", "Autistic users"],
  "CS-2": ["ADHD users", "Autistic users"],
  "CS-3": ["ADHD users", "Autistic users"],
  "CS-4": ["Dyslexia users", "ADHD users", "Autistic users"],
  "CS-5": ["ADHD users", "Autistic users"],
  "CS-6": ["ADHD users", "Autistic users"],
  "CS-7": ["Dyslexia users", "ADHD users", "Autistic users"],
  "CS-8": ["ADHD users", "Autistic users"],
};

export const COGNITIVE_OBJECTIVES_BY_RULE = {
  "IO-1": "Help Users Focus",
  "IO-2": "Help Users Focus",
  "IO-3": "Help Users Focus",
  "IO-4": "Help Users Focus",
  "IO-5": "Help Users Find What They Need",
  "RD-1": "Use Clear and Understandable Content",
  "RD-2": "Use Clear and Understandable Content",
  "RD-3": "Help Users Understand What Things are and How to Use Them",
  "RD-4": "Use Clear and Understandable Content",
  "RD-5": "Use Clear and Understandable Content",
  "RD-6": "Use Clear and Understandable Content",
  "ID-1": "Support Adaptation and Personalization",
  "ID-2": "Support Adaptation and Personalization",
  "ID-3": "Help Users Focus",
  "CS-1": "Help Users Understand What Things are and How to Use Them",
  "CS-2": "Help Users Find What They Need",
  "CS-3": "Ensure Processes Do Not Rely on Memory",
  "CS-4": "Help Users Understand What Things are and How to Use Them",
  "CS-5": "Help Users Find What They Need",
  "CS-6": "Help Users Find What They Need",
  "CS-7": "Help Users Understand What Things are and How to Use Them",
  "CS-8": "Help Users Understand What Things are and How to Use Them",
};

export const ISO_CLAUSES_BY_RULE = {
  "IO-1": ["6.3.3 Human effort expended", "6.4.3 Cognitive responses"],
  "IO-2": ["6.3.3 Human effort expended"],
  "IO-3": ["6.4.3 Cognitive responses", "6.4.4 Emotional responses"],
  "IO-4": ["6.2.1 Effectiveness general", "6.3.3 Human effort expended"],
  "IO-5": ["6.2.2 Accuracy", "6.3.3 Human effort expended"],
  "RD-1": ["6.2.2 Accuracy"],
  "RD-2": ["6.3.2 Time used", "6.3.3 Human effort expended"],
  "RD-3": ["6.2.2 Accuracy"],
  "RD-4": ["6.2.2 Accuracy", "6.4.3 Cognitive responses"],
  "RD-5": ["6.2.3 Completeness"],
  "RD-6": ["6.3.3 Human effort expended"],
  "ID-1": ["6.4.2 Physical responses", "6.4.4 Emotional responses"],
  "ID-2": ["6.4.2 Physical responses", "6.4.3 Cognitive responses"],
  "ID-3": ["6.2.3 Completeness", "6.4.4 Emotional responses"],
  "CS-1": ["6.3.3 Human effort expended"],
  "CS-2": ["6.2.2 Accuracy"],
  "CS-3": ["6.2.3 Completeness", "6.3.3 Human effort expended"],
  "CS-4": ["6.2.2 Accuracy"],
  "CS-5": ["6.3.2 Time used", "6.3.3 Human effort expended"],
  "CS-6": ["6.3.2 Time used"],
  "CS-7": ["6.2.2 Accuracy"],
  "CS-8": ["6.2.2 Accuracy", "6.3.3 Human effort expended"],
};

export const HIGHLIGHT_SETTINGS_BY_DIMENSION = {
  [INFORMATION_OVERLOAD_NAME]: {
    color: "#df3e53",
    selectors: [
      "main",
      "section",
      "article",
      "aside",
      "nav",
      "header",
      "h1",
      "h2",
      "button",
      "a",
      ".card",
      "[class*='card' i]",
      "[class*='grid' i]",
      "[class*='banner' i]",
      "[class*='sidebar' i]",
      "[class*='cta' i]",
      "[class*='hero' i]",
    ],
  },
  Readability: {
    color: "#2493dd",
    selectors: ["p", "li", "article", "section p", "button", "a"],
  },
  "Interaction & Distraction": {
    color: "#f0c400",
    selectors: [
      "dialog",
      "[role='dialog']",
      "[aria-modal='true']",
      "[aria-live]",
      "video",
      "audio",
      "iframe",
      "[autoplay]",
      "[class*='modal' i]",
      "[class*='popup' i]",
      "[class*='overlay' i]",
      "[class*='toast' i]",
      "[class*='chat' i]",
    ],
  },
  Consistency: {
    color: "#8d28df",
    selectors: [
      "h1",
      "h2",
      "h3",
      "nav",
      "header",
      "form",
      "label",
      "button",
      "a",
      "input",
      "select",
      "textarea",
      "[class*='nav' i]",
      "[class*='menu' i]",
      "[class*='step' i]",
      "[class*='breadcrumb' i]",
    ],
  },
};
