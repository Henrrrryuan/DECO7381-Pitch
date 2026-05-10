const lcMetadata = {
  rule_id: "LC-1",
  dimension: "Language Complexity",
  frameworks: {
    coga: "COGA: Prefer familiar vocabulary",
    iso: "ISO 9241-11:2018 6.2.2 Accuracy; 6.4.3 Cognitive responses",
    wcag: "WCAG SC 3.1.3 Unusual Words; SC 3.1.5 Reading Level (AAA)",
  },
  coga_objective: "Use Clear and Understandable Content",
  tooltip: {
    issue: "Vocabulary may be harder to understand quickly.",
    impact: "We check complex or uncommon word density.",
  },
  guidance: {
    steps: [
      "Replace dense or specialist words with familiar terms where possible.",
      "Keep necessary technical terms, but explain them in plain language.",
    ],
    goal: "Use familiar wording that users can decode quickly.",
    done_when: "Done when key wording is familiar or briefly explained.",
  },
};

export { lcMetadata };

